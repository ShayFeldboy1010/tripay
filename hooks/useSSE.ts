"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const parsed = JSON.parse(data) as { message?: string };
    return parsed.message ? new Error(parsed.message) : new Error("Stream error");
  } catch (err) {
    return new Error("Stream error");
  }
}

export function useSSE(options: UseSSEOptions = {}) {
  const { getToken } = options;
  const [isStreaming, setIsStreaming] = useState(false);
  const [usingFetchFallback, setUsingFetchFallback] = useState(false);
  const activeStreamRef = useRef<ActiveStream | null>(null);
  const fallbackPreference = useMemo(() => options.fallbackToFetch ?? true, [options.fallbackToFetch]);

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
    (stream: ActiveStream, status: "success" | "error" | "aborted", error?: Error) => {
      if (stream.done) return;
      stream.done = true;
      cleanup(stream);
      setIsStreaming(false);
      if (status === "error" && error) {
        stream.error = error;
        notify(stream.listeners.error, error);
        console.error("[ai-chat] stream_failed", error);
      }
      notifyDone(stream.listeners.done);
      if (activeStreamRef.current === stream) {
        activeStreamRef.current = null;
      }
    },
    [cleanup]
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
    async (stream: ActiveStream, url: string) => {
      console.info("[ai-chat] stream_started", { transport: "fetch" });
      let buffer = "";
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        cache: "no-store",
        signal: stream.controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Unexpected status: ${response.status}`);
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

      const fetchTokenAndStart = async () => {
        try {
          const token = (await getToken?.()) ?? null;
          if (!token) {
            const authError = new Error("Authentication required. Please sign in to continue.");
            (authError as Error & { code?: string }).code = "AUTH_REQUIRED";
            throw authError;
          }
          const url = buildExpensesStreamUrl({
            question: prompt,
            since: params.since,
            until: params.until,
            tz: params.tz,
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
              finalize(stream, "error", err instanceof Error ? err : new Error("Stream failed"));
            } else {
              finalize(stream, "aborted");
            }
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error("Stream failed to start");
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
  };
}

