// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSSE } from "@/hooks/useSSE";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: ((event?: Event) => void) | null = null;
  listeners = new Map<string, (event: MessageEvent<string>) => void>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, listener);
  }

  emit(type: string, data: string) {
    const handler = this.listeners.get(type);
    if (handler) handler(new MessageEvent(type, { data }));
  }

  triggerError() {
    this.onerror?.(new Event("error"));
  }

  close() {
    // noop
  }
}

describe("useSSE", () => {
  const encoder = new TextEncoder();
  const fetchSpy = vi.fn();

  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to fetch when EventSource fails before payload and resolves stream", async () => {
    const chunks = [
      "event: token\n",
      "data: hello\n\n",
      'event: result\n',
      'data: {"answer":"done","model":"gpt","provider":"openai","sql":"","timeRange":{"since":"2024-01-01","until":"2024-01-31","tz":"UTC"},"aggregates":{"totalsByCurrency":[],"total":null,"avg":null,"max":null,"byCategory":[],"byMerchant":[],"currencyNote":null},"rows":[],"plan":null,"usedFallback":false,"fallbackReason":null,"currencyNote":null}\n\n',
    ].join("");
    fetchSpy.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(chunks));
            controller.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      )
    );

    const { result } = renderHook(() => useSSE({ getToken: async () => "token", fallbackToFetch: true }));

    const tokens: string[] = [];
    let doneCount = 0;

    await act(async () => {
      const handle = result.current.startStream("question", { tz: "UTC", tripId: "trip-123" });
      await Promise.resolve();
      handle
        .onToken((token) => tokens.push(token))
        .onResult(() => {})
        .onError(() => {})
        .onDone(() => {
          doneCount += 1;
        });

      expect(MockEventSource.instances).toHaveLength(1);
      MockEventSource.instances[0]!.triggerError();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain("tripId=trip-123");
    expect(tokens.join("")).toContain("hello");
    expect(doneCount).toBe(1);
  });

  it("invokes onDone when aborted", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start() {
            // keep open until abort
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      )
    );

    const { result } = renderHook(() => useSSE({ getToken: async () => "token" }));

    let doneCount = 0;

    await act(async () => {
      const handle = result.current.startStream("stop", { tz: "UTC" });
      handle.onDone(() => {
        doneCount += 1;
      });
      handle.onError(() => {});
      handle.controller.abort();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(doneCount).toBe(1);
  });
});
