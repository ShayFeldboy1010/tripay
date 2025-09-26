"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface SSEMessage {
  event: string;
  data: string;
}

export interface UseSSEOptions {
  retryDelays?: number[];
  heartbeatMs?: number;
  pingEventName?: string;
  fallbackToFetch?: boolean;
}

export interface ConnectConfig {
  url: string;
  onEvent: (message: SSEMessage) => void;
  onOpen?: () => void;
  onError?: (error: Error) => void;
}

export interface SSEController {
  connect(config: ConnectConfig): void;
  close(): void;
  stopReconnecting(): void;
  isConnected: boolean;
  isConnecting: boolean;
  lastError: Error | null;
  usingFetchFallback: boolean;
}

const DEFAULT_RETRY_DELAYS = [500, 1000, 2000, 4000, 8000];

function isIOSDevice() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iP(ad|hone|od)/i.test(ua);
}

interface InternalState {
  controller: EventSource | null;
  abortController: AbortController | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  heartbeatTimer: ReturnType<typeof setTimeout> | null;
  attempt: number;
  shouldReconnect: boolean;
  fetchFallback: boolean;
  resolvedFetchFallback: boolean;
  lastPing: number;
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

export function useSSE(options: UseSSEOptions = {}): SSEController {
  const retryDelays = useMemo(() => options.retryDelays ?? DEFAULT_RETRY_DELAYS, [options.retryDelays]);
  const pingEventName = options.pingEventName ?? "ping";
  const heartbeatMs = options.heartbeatMs ?? 25_000;
  const fallbackToFetch = options.fallbackToFetch ?? true;

  const stateRef = useRef<InternalState>({
    controller: null,
    abortController: null,
    reconnectTimer: null,
    heartbeatTimer: null,
    attempt: 0,
    shouldReconnect: false,
    fetchFallback: false,
    resolvedFetchFallback: false,
    lastPing: Date.now(),
  });
  const configRef = useRef<ConnectConfig | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [, setUsingFetchFallbackTick] = useState(0);

  const usingFetchFallback = stateRef.current.fetchFallback || stateRef.current.resolvedFetchFallback;

  const cleanup = useCallback(() => {
    const state = stateRef.current;
    if (state.controller) {
      state.controller.close();
      state.controller = null;
    }
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.heartbeatTimer) {
      clearTimeout(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }, []);

  const scheduleHeartbeat = useCallback(() => {
    const state = stateRef.current;
    if (state.heartbeatTimer) {
      clearTimeout(state.heartbeatTimer);
    }
    state.heartbeatTimer = setTimeout(() => {
      const diff = Date.now() - state.lastPing;
      if (diff >= heartbeatMs) {
        if (state.shouldReconnect) {
          setLastError(new Error("Heartbeat timeout"));
          cleanup();
          state.attempt = 0;
          startConnection();
        }
      } else {
        scheduleHeartbeat();
      }
    }, heartbeatMs);
  }, [cleanup, heartbeatMs]);

  const handleMessage = useCallback(
    (message: SSEMessage) => {
      const config = configRef.current;
      if (!config) return;
      if (message.event === pingEventName) {
        stateRef.current.lastPing = Date.now();
        scheduleHeartbeat();
      }
      config.onEvent(message);
      if (message.event === "result") {
        stateRef.current.shouldReconnect = false;
        cleanup();
        setIsConnected(false);
        setIsConnecting(false);
      }
    },
    [cleanup, scheduleHeartbeat, pingEventName]
  );

  const handleConnectionError = useCallback(
    (err: Error, { dueToNetwork }: { dueToNetwork: boolean }) => {
      const config = configRef.current;
      setLastError(err);
      if (config?.onError) config.onError(err);
      const state = stateRef.current;
      if (!state.shouldReconnect) {
        cleanup();
        setIsConnected(false);
        setIsConnecting(false);
        return;
      }
      if (dueToNetwork && fallbackToFetch && !state.fetchFallback && !state.resolvedFetchFallback) {
        state.fetchFallback = true;
        setUsingFetchFallbackTick((x) => x + 1);
      }
      const delay = retryDelays[Math.min(state.attempt, retryDelays.length - 1)];
      if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(() => {
        state.attempt += 1;
        startConnection();
      }, delay);
    },
    [cleanup, fallbackToFetch, retryDelays]
  );

  const startFetchFallback = useCallback(
    async (config: ConnectConfig) => {
      const state = stateRef.current;
      const controller = new AbortController();
      state.abortController = controller;
      let buffer = "";
      try {
        const res = await fetch(config.url, {
          method: "GET",
          headers: { Accept: "text/event-stream" },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Unexpected status: ${res.status}`);
        }
        state.resolvedFetchFallback = true;
        setUsingFetchFallbackTick((x) => x + 1);
        if (config.onOpen) config.onOpen();
        setIsConnected(true);
        setIsConnecting(false);
        scheduleHeartbeat();
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          buffer += decoder.decode(value, { stream: true });
          buffer = parseSSEChunk(buffer, handleMessage);
        }
        if (state.shouldReconnect) {
          throw new Error("Connection closed");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        handleConnectionError(err instanceof Error ? err : new Error("Fetch stream failed"), { dueToNetwork: true });
      }
    },
    [handleConnectionError, handleMessage, scheduleHeartbeat]
  );

  const startEventSource = useCallback(
    (config: ConnectConfig) => {
      const state = stateRef.current;
      const source = new EventSource(config.url, { withCredentials: false });
      state.controller = source;

      const listen = (event: string) => {
        source.addEventListener(event, (raw) => {
          const message = raw as MessageEvent<string>;
          handleMessage({ event, data: message.data ?? "" });
        });
      };

      ["meta", "token", "result", "error", pingEventName].forEach(listen);

      source.onopen = () => {
        state.attempt = 0;
        setIsConnected(true);
        setIsConnecting(false);
        setLastError(null);
        state.lastPing = Date.now();
        scheduleHeartbeat();
        config.onOpen?.();
      };

      source.onerror = () => {
        const err = new Error("EventSource failed");
        source.close();
        state.controller = null;
        handleConnectionError(err, { dueToNetwork: true });
      };
    },
    [handleConnectionError, handleMessage, pingEventName, scheduleHeartbeat]
  );

  const startConnection = useCallback(() => {
    const config = configRef.current;
    if (!config) return;
    const state = stateRef.current;
    cleanup();
    setIsConnecting(true);
    setIsConnected(false);

    const useFetch = state.fetchFallback || state.resolvedFetchFallback || (fallbackToFetch && isIOSDevice());
    if (!useFetch && typeof EventSource !== "undefined") {
      try {
        startEventSource(config);
        return;
      } catch (err) {
        handleConnectionError(err instanceof Error ? err : new Error("Failed to init EventSource"), { dueToNetwork: true });
        return;
      }
    }
    startFetchFallback(config);
  }, [cleanup, fallbackToFetch, handleConnectionError, startEventSource, startFetchFallback]);

  const connect = useCallback(
    (config: ConnectConfig) => {
      configRef.current = config;
      const state = stateRef.current;
      state.shouldReconnect = true;
      state.attempt = 0;
      state.lastPing = Date.now();
      state.fetchFallback = false;
      setLastError(null);
      startConnection();
    },
    [startConnection]
  );

  const close = useCallback(() => {
    stateRef.current.shouldReconnect = false;
    cleanup();
    setIsConnected(false);
    setIsConnecting(false);
  }, [cleanup]);

  const stopReconnecting = useCallback(() => {
    stateRef.current.shouldReconnect = false;
    if (!stateRef.current.controller && !stateRef.current.abortController) {
      cleanup();
      setIsConnecting(false);
    }
  }, [cleanup]);

  useEffect(() => close, [close]);

  return {
    connect,
    close,
    stopReconnecting,
    isConnected,
    isConnecting,
    lastError,
    usingFetchFallback,
  };
}

