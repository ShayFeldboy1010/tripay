// @vitest-environment jsdom
const originalFetch = globalThis.fetch;

const { mockStartStream, mockAbort, mockFetch, toastError } = vi.hoisted(() => {
  const createHandle = () => {
    const handle: any = {
      controller: new AbortController(),
      onToken: vi.fn(() => handle),
      onMeta: vi.fn(() => handle),
      onResult: vi.fn(() => handle),
      onError: vi.fn(() => handle),
      onDone: vi.fn(() => handle),
    };
    return handle;
  };
  return {
    mockStartStream: vi.fn(() => createHandle()),
    mockAbort: vi.fn(),
    mockFetch: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => true }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import { AIChatPanel } from "@/components/AIChatPanel";
import { AIChatProvider } from "@/components/AIChatStore";

beforeEach(() => {
  mockStartStream.mockClear();
  mockAbort.mockClear();
  mockFetch.mockReset();
  toastError.mockClear();
  (window as any).__AI_CHAT_TEST_USER__ = "user-123";
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ token: "test-token" }),
  } as Response);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.scrollTo = vi.fn();
});

afterAll(() => {
  vi.unmock("@/hooks/useIsDesktop");
  vi.unmock("sonner");
  globalThis.fetch = originalFetch;
});

describe("AIChatPanel submit flow", () => {
  const renderPanel = () =>
    render(
      <AIChatProvider>
        <AIChatPanel
          tripId="trip-1"
          open
          useSSEHook={() => ({
            startStream: mockStartStream,
            abortCurrent: mockAbort,
            isStreaming: false,
            usingFetchFallback: false,
          })}
        />
      </AIChatProvider>
    );

  it("trims input and blocks empty submissions", async () => {
    renderPanel();

    const textarea = await screen.findByPlaceholderText("Ask about your expenses…");
    await screen.findByText(/Filtering/);
    await waitFor(() => expect(document.body.contains(textarea)).toBe(true));

    fireEvent.change(textarea, { target: { value: "   highest expense?   " } });
    fireEvent.submit(textarea.closest("form")!);

    await waitFor(() => expect(mockStartStream).toHaveBeenCalledTimes(1));
    expect(mockStartStream.mock.calls[0]?.[0]).toBe("highest expense?");

    const initialCalls = mockStartStream.mock.calls.length;
    toastError.mockClear();
    const textareaAfter = screen.getByPlaceholderText("Ask about your expenses…");
    fireEvent.change(textareaAfter, { target: { value: "    " } });
    await waitFor(() => expect((textareaAfter as HTMLTextAreaElement).value).toBe("    "));
    fireEvent.submit(textareaAfter.closest("form")!);
    expect(mockStartStream.mock.calls.length).toBe(initialCalls);

    const shell = textarea.closest("form")!.querySelector(".chat-input-shell") as HTMLElement;
    await waitFor(() => expect(shell.className).toContain("chat-input-shell-shake"));
  });

  it("submits on Enter and keeps Shift+Enter as newline", async () => {
    renderPanel();

    const textarea = await screen.findByPlaceholderText("Ask about your expenses…");
    await screen.findByText(/Filtering/);
    fireEvent.change(textarea, { target: { value: "Show totals" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(mockStartStream).toHaveBeenCalledTimes(1));

    const callsAfterEnter = mockStartStream.mock.calls.length;
    const textareaAfter = screen.getByPlaceholderText("Ask about your expenses…");
    fireEvent.change(textareaAfter, { target: { value: "Line 1" } });
    fireEvent.keyDown(textareaAfter, { key: "Enter", code: "Enter", shiftKey: true });
    expect(mockStartStream.mock.calls.length).toBe(callsAfterEnter);
  });

  it("has a submit button with correct accessibility and pointer events", async () => {
    renderPanel();

    const button = await screen.findByRole("button", { name: /send message/i });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("type")).toBe("submit");

    const textarea = await screen.findByPlaceholderText("Ask about your expenses…");
    fireEvent.change(textarea, { target: { value: "Can I expense lunch?" } });

    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    expect(window.getComputedStyle(button).pointerEvents).toBe("auto");
  });
});
