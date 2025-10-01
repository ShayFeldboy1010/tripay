"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildExpensesStreamUrl, type ExpensesChatMetaEvent, type ExpensesChatResult } from "@/services/ai/askAI";

export interface SSEMessage {
  event: string;
  data: string;
}

export interface UseSSEOptions {
  fallbackToFetch?: boolean;
  getToken?: () => Promise<string | null>;
}

export interface StartStreamParams {
  since?: string;
  until?: string;
  tz?: string;
  tripId?: string | null;
  userId?: string | null;
}

export interface StreamHandle {
  controller: AbortController;
  onToken(cb: (token: string) => void): StreamHandle;
  onMeta(cb: (meta: ExpensesChatMetaEvent) => void): StreamHandle;
  onResult(cb: (result: ExpensesChatResult) => void): StreamHandle;
  onError(cb: (error: Error) => void): StreamHandle;
  onDone(cb: () => void): StreamHandle;
}

interface ListenerMap {
  token: Set<(token: string) => void>;
  meta: Set<(meta: ExpensesChatMetaEvent) => void>;
  result: Set<(result: ExpensesChatResult) => void>;
  error: Set<(error: Error) => void>;
  done: Set<() => void>;
}

interface ActiveStream {
  controller: AbortController;
  listeners: ListenerMap;
  fallbackTried: boolean;
  done: boolean;
  firstTokenAt: number | null;
  error: Error | null;
  eventSource: EventSource | null;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  prompt: string;
  startedAt: number;
  firstContentSeen: boolean;
}

export type StreamPhase = "idle" | "drafting" | "streaming" | "completed" | "error";

export class ChatStreamError extends Error {
  code: string;
  retriable: boolean;

  constructor(code: string, message: string, options: { retriable?: boolean } = {}) {
    super(message);
    this.name = "ChatStreamError";
    this.code = code;
    this.retriable = Boolean(options.retriable);
  }
}

export interface StreamStatus {
  phase: StreamPhase;
  attempt: number;
  lastError: ChatStreamError | null;
}

export type StreamAction =
  | { type: "reset" }
  | { type: "drafting" }
  | { type: "streaming" }
  | { type: "completed" }
  | { type: "error"; error: ChatStreamError };

export const initialStreamStatus: StreamStatus = {
  phase: "idle",
  attempt: 0,
  lastError: null,
};

export function streamStatusReducer(state: StreamStatus, action: StreamAction): StreamStatus {
  switch (action.type) {
    case "reset":
      return { ...initialStreamStatus };
    case "drafting":
      return { phase: "drafting", attempt: state.attempt + 1, lastError: null };
    case "streaming":
      if (state.phase === "streaming") return state;
      return { ...state, phase: "streaming" };
    case "completed":
      return { ...state, phase: "completed" };
    case "error":
      return { phase: "error", attempt: state.attempt, lastError: action.error };
    default:
      return state;
  }
}

function createListenerMap(): ListenerMap {
  return {
    token: new Set(),
    meta: new Set(),
    result: new Set(),
    error: new Set(),
    done: new Set(),
  };
}

function notify<T>(listeners: Set<(value: T) => void>, value: T) {
  listeners.forEach((listener) => {
    try {
      listener(value);
    } catch (err) {
      console.error("[ai-chat] listener error", err);
    }
  });
}

function notifyDone(listeners: Set<() => void>) {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("[ai-chat] listener error", err);
    }
  });
}

function parseSSEChunk(buffer: string, onEvent: (message: SSEMessage) => void): string {
  let rest = buffer;
  for (;;) {
    const delimiterIndex = rest.search(/\n\n|\r\n\r\n/);
    if (delimiterIndex === -1) break;
    const raw = rest.slice(0, delimiterIndex);
    rest = rest.slice(delimiterIndex + (rest[delimiterIndex] === "\r" ? 4 : 2));
    let event = "message";
    const data: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(5).trimStart());
      }
    }
    onEvent({ event, data: data.join("\n") });
  }
  return rest;
}

function parseMeta(data: string) {
  return JSON.parse(data) as ExpensesChatMetaEvent;
}

function parseResult(data: string) {
  return JSON.parse(data) as ExpensesChatResult;
}

function parseError(data: string) {
  try {
    const parsed = JSON.parse(data) as { code?: string; message?: string };
    const code = parsed.code ?? "AI-500";
    const message = parsed.message ?? "Stream error";
    return new ChatStreamError(code, message, { retriable: code === "AI-408" || code.startsWith("AI-5") });
  } catch (err) {
    return new ChatStreamError("AI-500", "Stream error");
  }
}

export function useSSE(options: UseSSEOptions = {}) {
  const { getToken } = options;
  const [isStreaming, setIsStreaming] = useState(false);
  const [usingFetchFallback, setUsingFetchFallback] = useState(false);
  const activeStreamRef = useRef<ActiveStream | null>(null);
  const fallbackPreference = useMemo(() => options.fallbackToFetch ?? true, [options.fallbackToFetch]);
  const [status, dispatch] = useReducer(streamStatusReducer, initialStreamStatus);
  const debug = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const params = new URLSearchParams(window.location.search);
      const flags = params.getAll("debug");
      if (!flags.length) return false;
      return flags.some((flag) => flag.split(",").map((v) => v.trim().toLowerCase()).includes("ai"));
    } catch (err) {
      console.warn("[ai-chat] failed to read debug flag", err);
      return false;
    }
  }, []);

  const cleanup = useCallback((stream: ActiveStream | null) => {
    if (!stream) return;
    if (stream.eventSource) {
      stream.eventSource.close();
      stream.eventSource = null;
    }
    if (stream.reader) {
      try {
        stream.reader.cancel().catch(() => {});
      } catch (err) {
        // ignore
      }
      stream.reader = null;
    }
  }, []);

  useEffect(() => () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.controller.abort();
      cleanup(activeStreamRef.current);
    }
  }, [cleanup]);

  const finalize = useCallback(
    (stream: ActiveStream, outcome: "success" | "error" | "aborted", error?: Error) => {
      if (stream.done) return;
      stream.done = true;
      cleanup(stream);
      setIsStreaming(false);
      if (outcome === "success") {
        dispatch({ type: "completed" });
      } else if (outcome === "error" && error) {
        stream.error = error;
        const normalized = error instanceof ChatStreamError ? error : new ChatStreamError("AI-500", error.message);
        dispatch({ type: "error", error: normalized });
        notify(stream.listeners.error, normalized);
        console.error("[ai-chat] stream_failed", normalized);
      } else {
        dispatch({ type: "reset" });
      }
      if (debug) {
        console.debug("[ai-chat] stream_finalize", { outcome, hasError: Boolean(error) });
      }
      notifyDone(stream.listeners.done);
      if (activeStreamRef.current === stream) {
        activeStreamRef.current = null;
      }
    },
    [activeStreamRef, cleanup, debug]
  );

  const handleMessage = useCallback(
    (stream: ActiveStream, message: SSEMessage) => {
      switch (message.event) {
        case "meta": {
          try {
            const meta = parseMeta(message.data);
            notify(stream.listeners.meta, meta);
          } catch (err) {
            console.warn("[ai-chat] failed to parse meta", err);
          }
          break;
        }
        case "token": {
          stream.firstContentSeen = true;
          dispatch({ type: "streaming" });
          if (stream.firstTokenAt === null) {
            stream.firstTokenAt = performance.now();
            console.info("[ai-chat] first_token_ms", Math.round(stream.firstTokenAt - stream.startedAt));
          }
          notify(stream.listeners.token, message.data);
          break;
        }
        case "result": {
          stream.firstContentSeen = true;
          try {
            const result = parseResult(message.data);
            notify(stream.listeners.result, result);
            finalize(stream, "success");
          } catch (err) {
            finalize(stream, "error", err instanceof Error ? err : new Error("Result parse error"));
          }
          break;
        }
        case "error": {
          const err = parseError(message.data);
          finalize(stream, "error", err);
          break;
        }
        default:
          break;
      }
    },
    [finalize]
  );

  const startEventSource = useCallback(
    (stream: ActiveStream, url: string) =>
      new Promise<void>((resolve, reject) => {
        try {
          const source = new EventSource(url, { withCredentials: false });
          stream.eventSource = source;

          source.addEventListener("meta", (event) => {
            handleMessage(stream, { event: "meta", data: (event as MessageEvent<string>).data ?? "" });
          });
          source.addEventListener("token", (event) => {
            handleMessage(stream, { event: "token", data: (event as MessageEvent<string>).data ?? "" });
          });
          source.addEventListener("result", (event) => {
            handleMessage(stream, { event: "result", data: (event as MessageEvent<string>).data ?? "" });
          });
          source.addEventListener("error", (event) => {
            handleMessage(stream, { event: "error", data: (event as MessageEvent<string>).data ?? "" });
          });

          source.onopen = () => {
            console.info("[ai-chat] stream_started", { transport: "eventsource" });
          };

          source.onerror = () => {
            if (stream.done) return;
            source.close();
            stream.eventSource = null;
            if (!stream.firstContentSeen) {
              reject(new Error("EventSource failed"));
            } else {
              reject(new Error("EventSource interrupted"));
            }
          };

          stream.controller.signal.addEventListener(
            "abort",
            () => {
              source.close();
              stream.eventSource = null;
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true }
          );
        } catch (err) {
          reject(err instanceof Error ? err : new Error("EventSource failed"));
        }
      }),
    [handleMessage]
  );

  const startFetchFallback = useCallback(
    async (stream: ActiveStream, url: string, attempt = 0): Promise<void> => {
      const fetchController = new AbortController();
      const timeoutMs = 25_000;
      const timeout = setTimeout(() => {
        fetchController.abort(new DOMException("Timeout", "AbortError"));
      }, timeoutMs);
      const signal = mergeAbortSignals([stream.controller.signal, fetchController.signal]);
      console.info("[ai-chat] stream_started", { transport: "fetch", attempt: attempt + 1 });
      let buffer = "";
      let response: Response;
      try {
        response = await fetch(url, {
          method: "GET",
          headers: { Accept: "text/event-stream" },
          cache: "no-store",
          signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new ChatStreamError("AI-408", "Request timed out", { retriable: true });
        }
        throw err instanceof Error ? err : new Error("Stream failed");
      }
      clearTimeout(timeout);
      if (!response.ok || !response.body) {
        const parsed = await parseResponseError(response);
        if (parsed instanceof ChatStreamError && parsed.retriable && attempt < 1) {
          const jitter = 200 + Math.floor(Math.random() * 400);
          await wait(jitter);
          return startFetchFallback(stream, url, attempt + 1);
        }
        throw parsed;
      }
      const reader = response.body.getReader();
      stream.reader = reader;
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSSEChunk(buffer, (evt) => handleMessage(stream, evt));
      }
      stream.reader = null;
      if (!stream.done) {
        if (stream.firstContentSeen) {
          finalize(stream, "success");
        } else {
          throw new Error("Stream closed");
        }
      }
    },
    [finalize, handleMessage]
  );

  const startStream = useCallback(
    (prompt: string, params: StartStreamParams): StreamHandle => {
      const controller = new AbortController();
      const listeners = createListenerMap();
      const stream: ActiveStream = {
        controller,
        listeners,
        fallbackTried: false,
        done: false,
        firstTokenAt: null,
        error: null,
        eventSource: null,
        reader: null,
        prompt,
        startedAt: performance.now(),
        firstContentSeen: false,
      };

      if (activeStreamRef.current) {
        activeStreamRef.current.controller.abort();
      }
      activeStreamRef.current = stream;
      setIsStreaming(true);
      dispatch({ type: "drafting" });

      const fetchTokenAndStart = async () => {
        try {
          const token = (await getToken?.()) ?? null;
          const url = buildExpensesStreamUrl({
            question: prompt,
            since: params.since,
            until: params.until,
            tz: params.tz,
            tripId: params.tripId ?? null,
            userId: params.userId ?? null,
            token,
          });

          console.info("[ai-chat] submit_clicked", { hasRange: Boolean(params.since && params.until) });

          try {
            setUsingFetchFallback(false);
            await startEventSource(stream, url);
          } catch (err) {
            if (stream.done) return;
            const networkError = err instanceof DOMException && err.name === "AbortError";
            if (!stream.firstContentSeen && fallbackPreference && !stream.fallbackTried && !networkError) {
              stream.fallbackTried = true;
              setUsingFetchFallback(true);
              await startFetchFallback(stream, url);
            } else if (!networkError) {
              const normalized = err instanceof ChatStreamError ? err : err instanceof Error ? err : new Error("Stream failed");
              finalize(stream, "error", normalized);
            } else {
              finalize(stream, "aborted");
            }
          }
        } catch (err) {
          const error = err instanceof ChatStreamError
            ? err
            : err instanceof Error
              ? err
              : new ChatStreamError("AI-500", "Stream failed to start");
          finalize(stream, error.name === "AbortError" ? "aborted" : "error", error);
        }
      };

      fetchTokenAndStart();

      controller.signal.addEventListener(
        "abort",
        () => {
          finalize(stream, "aborted", new DOMException("Aborted", "AbortError"));
        },
        { once: true }
      );

      const handle: StreamHandle = {
        controller,
        onToken(cb) {
          listeners.token.add(cb);
          return handle;
        },
        onMeta(cb) {
          listeners.meta.add(cb);
          return handle;
        },
        onResult(cb) {
          listeners.result.add(cb);
          return handle;
        },
        onError(cb) {
          if (stream.error) {
            cb(stream.error);
          } else {
            listeners.error.add(cb);
          }
          return handle;
        },
        onDone(cb) {
          if (stream.done) {
            cb();
          } else {
            listeners.done.add(cb);
          }
          return handle;
        },
      };

      return handle;
    },
    [activeStreamRef, fallbackPreference, finalize, getToken, startEventSource, startFetchFallback]
  );

  const abortCurrent = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.controller.abort();
    }
  }, []);

  return {
    startStream,
    abortCurrent,
    isStreaming,
    usingFetchFallback,
    state: status,
  };
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const filtered = signals.filter(Boolean);
  if (filtered.length === 1) return filtered[0]!;
  const controller = new AbortController();
  const onAbort = (event: Event) => {
    controller.abort((event as any)?.detail ?? undefined);
  };
  filtered.forEach((signal) => {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  return controller.signal;
}

async function parseResponseError(response: Response) {
  let payload: any = null;
  try {
    payload = await response.clone().json();
  } catch {
    // ignore
  }
  const fallbackCode = response.status >= 500 ? "AI-500" : `AI-${response.status}`;
  const code = typeof payload?.code === "string" ? payload.code : fallbackCode;
  const message = typeof payload?.message === "string" ? payload.message : `Unexpected status: ${response.status}`;
  const retriable = response.status === 429 || response.status >= 500;
  return new ChatStreamError(code, message, { retriable });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

