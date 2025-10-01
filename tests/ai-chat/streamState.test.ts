import { describe, expect, it } from "vitest";
import { ChatStreamError, initialStreamStatus, streamStatusReducer } from "@/hooks/useSSE";

describe("useSSE stream state", () => {
  it("advances drafting → streaming → completed", () => {
    const drafting = streamStatusReducer(initialStreamStatus, { type: "drafting" });
    expect(drafting.phase).toBe("drafting");
    expect(drafting.attempt).toBe(1);

    const streaming = streamStatusReducer(drafting, { type: "streaming" });
    expect(streaming.phase).toBe("streaming");
    expect(streaming.attempt).toBe(1);

    const completed = streamStatusReducer(streaming, { type: "completed" });
    expect(completed.phase).toBe("completed");
    expect(completed.attempt).toBe(1);
    expect(completed.lastError).toBeNull();
  });

  it("records error with retryable metadata", () => {
    const drafting = streamStatusReducer(initialStreamStatus, { type: "drafting" });
    const failure = new ChatStreamError("AI-502", "LLM unavailable", { retriable: true });
    const errored = streamStatusReducer(drafting, { type: "error", error: failure });
    expect(errored.phase).toBe("error");
    expect(errored.attempt).toBe(1);
    expect(errored.lastError?.code).toBe("AI-502");
    expect(errored.lastError?.retriable).toBe(true);
  });

  it("resets to idle", () => {
    const errored = { ...initialStreamStatus, phase: "error" as const, attempt: 3, lastError: null };
    const reset = streamStatusReducer(errored, { type: "reset" });
    expect(reset).toEqual(initialStreamStatus);
  });
});
