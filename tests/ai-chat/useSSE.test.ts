// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSSE } from "@/hooks/useSSE";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, (event: MessageEvent<string>) => void>();

  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = Boolean(init?.withCredentials);
    MockEventSource.instances.push(this);
  }

  emit(type: string, data: string) {
    const handler = this.listeners.get(type);
    if (handler) handler(new MessageEvent(type, { data }));
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, listener);
  }

  close() {
    // noop
  }
}

describe("useSSE", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.useFakeTimers();
    // @ts-expect-error override global EventSource for testing
    global.EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reconnects after heartbeat timeout", () => {
    const events: string[] = [];
    const { result } = renderHook(() => useSSE({ heartbeatMs: 1000, retryDelays: [100] }));

    act(() => {
      result.current.connect({
        url: "/test",
        onEvent: (evt) => events.push(evt.event),
      });
    });

    expect(MockEventSource.instances.length).toBe(1);
    const instance = MockEventSource.instances[0]!;

    act(() => {
      instance.onopen?.();
    });

    // advance just before timeout
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(MockEventSource.instances.length).toBe(1);

    // timeout triggers reconnect
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(MockEventSource.instances.length).toBeGreaterThan(1);
  });

  it("resets heartbeat on ping", () => {
    const { result } = renderHook(() => useSSE({ heartbeatMs: 1000, retryDelays: [100] }));

    act(() => {
      result.current.connect({
        url: "/ping",
        onEvent: () => {},
      });
    });

    const instance = MockEventSource.instances[0]!;
    act(() => instance.onopen?.());

    act(() => {
      vi.advanceTimersByTime(800);
    });

    act(() => {
      instance.emit("ping", "{}");
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(MockEventSource.instances.length).toBe(1);
  });
});

