"use client";

import React, { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles, X } from "lucide-react";
import { DateTime } from "luxon";
import { toast } from "sonner";
import { type ExpensesChatMetaEvent, type ExpensesChatResult } from "@/services/ai/askAI";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useSSE, type StreamHandle } from "@/hooks/useSSE";
import { useSupabaseUserId } from "@/hooks/useSupabaseUserId";
import { ChatBubble } from "./ai-chat/ChatBubble";
import { useAIChat } from "./AIChatStore";
import { Modal } from "./Modal";

type RangeOptionId = "thisMonth" | "last7" | "lastMonth" | "ytd" | "custom";

interface RangeOption {
  id: RangeOptionId;
  label: string;
  compute(zone: string): { since: string; until: string };
}

const RANGE_OPTIONS: RangeOption[] = [
  {
    id: "thisMonth",
    label: "This month",
    compute: (zone) => {
      const now = DateTime.now().setZone(zone);
      return { since: now.startOf("month").toISODate()!, until: now.toISODate()! };
    },
  },
  {
    id: "last7",
    label: "Last 7 days",
    compute: (zone) => {
      const now = DateTime.now().setZone(zone);
      return { since: now.minus({ days: 6 }).toISODate()!, until: now.toISODate()! };
    },
  },
  {
    id: "lastMonth",
    label: "Last month",
    compute: (zone) => {
      const lastMonth = DateTime.now().setZone(zone).minus({ months: 1 });
      return { since: lastMonth.startOf("month").toISODate()!, until: lastMonth.endOf("month").toISODate()! };
    },
  },
  {
    id: "ytd",
    label: "Year to date",
    compute: (zone) => {
      const now = DateTime.now().setZone(zone);
      return { since: now.startOf("year").toISODate()!, until: now.toISODate()! };
    },
  },
];

async function fetchSseToken(userId: string) {
  const res = await fetch("/api/ai/expenses/chat/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error("Unable to obtain stream token");
  }
  const payload = (await res.json()) as { token?: string };
  if (!payload.token) {
    throw new Error("Stream token missing");
  }
  return payload.token;
}

function ResultDataPanel({ result, meta }: { result: ExpensesChatResult; meta?: ExpensesChatMetaEvent | null }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((prev) => !prev);
  return (
    <div className="mt-3">
      <button
        type="button"
        className="flex items-center gap-2 text-[12px] font-semibold text-[color:var(--chat-primary)] transition hover:text-white"
        onClick={toggle}
        aria-expanded={open}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Data
      </button>
      {open ? (
        <div className="mt-3 space-y-4 rounded-2xl border border-[color:var(--chat-border-soft)]/70 bg-[color:var(--chat-bg-card)]/90 p-4 text-[13px] shadow-[0_16px_38px_rgba(5,8,18,0.55)]">
          <section className="space-y-1">
            <h4 className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--chat-text-muted)]">SQL</h4>
            <pre className="max-h-40 overflow-auto rounded-xl bg-black/30 p-3 font-mono text-[12px] text-[color:var(--chat-text-muted)]">
              {result.sql}
            </pre>
          </section>
          <section className="space-y-1 text-[color:var(--chat-text-muted)]">
            <h4 className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--chat-text-muted)]">Range</h4>
            <p>
              {result.timeRange.since} → {result.timeRange.until} ({result.timeRange.tz})
            </p>
            {meta ? <p>User last 4: ••••{meta.userId_last4}</p> : null}
          </section>
          <section className="space-y-1 text-[color:var(--chat-text-muted)]">
            <h4 className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--chat-text-muted)]">Totals</h4>
            {result.aggregates.totalsByCurrency.length === 0 ? (
              <p>No matching rows.</p>
            ) : (
              <ul className="space-y-1">
                {result.aggregates.totalsByCurrency.map((item) => (
                  <li key={item.currency}>
                    {item.currency} • total {item.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} • avg {item.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })} • {item.count} tx
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2 text-[color:var(--chat-text-muted)]">
            <h4 className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--chat-text-muted)]">Rows</h4>
            <div className="max-h-60 overflow-auto rounded-xl border border-[color:var(--chat-border-soft)]/60 bg-black/20">
              <table className="w-full min-w-[320px] border-collapse text-[12px]">
                <thead className="sticky top-0 bg-[color:var(--chat-bg-card)]/90 text-[color:var(--chat-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Merchant</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 20).map((row, idx) => (
                    <tr key={`${row.date}-${row.merchant ?? ""}-${idx}`} className="odd:bg-black/10 even:bg-black/5 text-white/90">
                      <td className="px-3 py-2 text-[color:var(--chat-text-muted)]">{row.date}</td>
                      <td className="px-3 py-2 text-white">
                        {row.currency} {Number(row.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-[color:var(--chat-text-muted)]">{row.category ?? "—"}</td>
                      <td className="px-3 py-2 text-[color:var(--chat-text-muted)]">{row.merchant ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

const bottomInsetClass = "pb-[calc(var(--bottom-ui)+var(--safe-bottom))]"; // TODO(shay): verify nav height

export function AIChatPanel({
  tripId,
  open,
  useSSEHook = useSSE,
}: {
  tripId: string;
  open: boolean;
  useSSEHook?: typeof useSSE;
}) {
  const isDesktop = useIsDesktop();
  const { messages, addMessage, updateLastMessage, close, meta, setMeta } = useAIChat();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [input, setInput] = useState("");
  const [activeRange, setActiveRange] = useState<{ id: RangeOptionId; since: string; until: string } | null>(null);
  const [timezone, setTimezone] = useState<string>("Asia/Seoul");
  const { userId } = useSupabaseUserId();
  const userIdRef = useRef<string | null>(userId ?? null);
  const [isShaking, setIsShaking] = useState(false);
  const inputShellRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<StreamHandle | null>(null);
  const { startStream, abortCurrent, isStreaming } = useSSEHook({
    fallbackToFetch: true,
    getToken: async () => {
      const id = userIdRef.current;
      if (!id) return null;
      return fetchSseToken(id);
    },
  });
  const titleId = useId();
  const descriptionId = useId();

  const msgs = useMemo(() => messages[tripId] || [], [messages, tripId]);

  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) {
      setTimezone(resolved);
    }
  }, []);

  useEffect(() => {
    userIdRef.current = userId ?? null;
  }, [userId]);

  useEffect(() => {
    if (!open) {
      abortCurrent();
      return;
    }
    const defaultRange = RANGE_OPTIONS[0];
    const computed = defaultRange.compute(timezone);
    setActiveRange({ id: defaultRange.id, ...computed });
    setTimeout(() => inputRef.current?.focus(), 180);
  }, [abortCurrent, open, timezone]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }
    });
  }, [msgs, open]);

  const info = meta[tripId];

  const handleRangeClick = useCallback(
    (option: RangeOption) => {
      const computed = option.compute(timezone);
      setActiveRange({ id: option.id, ...computed });
    },
    [timezone]
  );

  const submitPrompt = useCallback(
    (rawQuestion: string, options?: { fromRetry?: boolean }) => {
      const normalized = rawQuestion.replace(/\s+/g, " ").trim();
      if (!normalized) {
        toast.error("Please enter a question");
        setIsShaking(true);
        return;
      }
      if (!activeRange) {
        toast.error("Select a time range first");
        return;
      }
      const currentUserId = userIdRef.current;
      if (!currentUserId) {
        toast.error("You need to be signed in to use AI chat");
        return;
      }

      if (streamRef.current) {
        streamRef.current.controller.abort();
      }

      setIsShaking(false);
      if (options?.fromRetry) {
        updateLastMessage(tripId, (prev) => {
          if (prev.role !== "assistant") return prev;
          return { ...prev, text: "", streaming: true, error: null, retryPrompt: null, result: null, meta: null };
        });
      } else {
        addMessage(tripId, { role: "user", text: normalized });
        addMessage(tripId, { role: "assistant", text: "", streaming: true });
      }

      setInput("");
      requestAnimationFrame(() => inputRef.current?.focus());

      const stream = startStream(normalized, {
        since: activeRange.since,
        until: activeRange.until,
        tz: timezone,
      });

      streamRef.current = stream;

      stream
        .onMeta((event) => {
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, meta: event };
          });
        })
        .onToken((token) => {
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, text: prev.text + token, streaming: true };
          });
        })
        .onResult((result) => {
          setMeta(tripId, { provider: result.provider, model: result.model });
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return {
              ...prev,
              text: result.answer.trim(),
              streaming: false,
              result,
              error: null,
              retryPrompt: null,
            };
          });
        })
        .onError((err) => {
          toast.error(err.message);
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return {
              ...prev,
              streaming: false,
              error: err.message,
              retryPrompt: normalized,
            };
          });
        })
        .onDone(() => {
          streamRef.current = null;
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, streaming: false };
          });
        });
    },
    [activeRange, addMessage, setMeta, startStream, timezone, tripId, updateLastMessage]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      submitPrompt(input);
    },
    [input, submitPrompt]
  );

  const handleRetry = useCallback(
    (prompt: string) => {
      submitPrompt(prompt, { fromRetry: true });
    },
    [submitPrompt]
  );

  const containerClassName = isDesktop
    ? "items-end justify-center px-0 py-0 sm:px-6 sm:py-8 md:items-center md:justify-end"
    : "items-end justify-center px-0 py-0";

  return (
    <Modal
      open={open}
      onClose={close}
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={titleRef}
      containerClassName={containerClassName}
      overlayClassName="chat-panel-overlay"
      contentClassName={
        isDesktop
          ? "chat-panel w-full max-w-[560px] rounded-none border border-[color:var(--chat-border-soft)]/60 bg-[color:var(--chat-bg-app)]/95 md:rounded-[32px]"
          : "chat-panel w-full rounded-none border border-[color:var(--chat-border-soft)]/60 bg-[color:var(--chat-bg-app)]/96"
      }
    >
      <div className="flex min-100dvh min-vh flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[color:var(--chat-border-soft)]/60 bg-[color:var(--chat-bg-app)]/92 px-6 py-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--chat-primary)]/15 text-[color:var(--chat-primary)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2
                id={titleId}
                ref={titleRef}
                tabIndex={-1}
                className="text-lg font-semibold tracking-tight text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                AI Expenses
              </h2>
              <p id={descriptionId} className="text-[13px] text-[color:var(--chat-text-muted)]">
                Ask grounded questions about this trip&apos;s spending.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close chat"
            onClick={close}
            className="rounded-full border border-[color:var(--chat-border-soft)]/80 bg-black/30 p-2 text-[color:var(--chat-text-muted)] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div
          ref={listRef}
          className={`chat-scroll-area relative z-[1] flex-1 overflow-y-auto [overscroll-behavior:contain] ${bottomInsetClass}`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="px-6 pb-4 pt-5">
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => {
                const active = activeRange?.id === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleRangeClick(option)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? "bg-[color:var(--chat-primary)] text-black shadow-[0_12px_30px_rgba(106,168,255,0.45)]"
                        : "bg-white/5 text-[color:var(--chat-text-muted)] hover:bg-white/10"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {activeRange ? (
              <p className="mt-3 text-[12px] text-[color:var(--chat-text-muted)]">
                Filtering {activeRange.since} → {activeRange.until} ({timezone})
              </p>
            ) : null}
          </div>
          <div className="space-y-4 px-6 pb-8" aria-live="polite">
            {msgs.map((m, index) => {
              if (m.role === "user") {
                return (
                  <ChatBubble key={index} role="user">
                    <p>{m.text}</p>
                  </ChatBubble>
              );
            }

            if (m.streaming && !m.text) {
              return (
                <ChatBubble key={index} role="assistant" streaming>
                  <div className="space-y-2">
                    <div className="chat-skeleton h-4 w-36 rounded-full" />
                    <div className="chat-skeleton h-4 w-28 rounded-full" />
                  </div>
                </ChatBubble>
              );
            }

            return (
              <ChatBubble
                key={index}
                role="assistant"
                streaming={m.streaming}
                meta={m.reconnecting ? "Network interrupted. Reconnecting…" : undefined}
              >
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-white/90">{m.text}</p>
                {m.result ? <ResultDataPanel result={m.result} meta={m.meta} /> : null}
                {m.error ? (
                  <div className="mt-3 flex flex-col gap-2 text-[12px] text-red-400">
                    <p>{m.error}</p>
                    {m.retryPrompt ? (
                      <button
                        type="button"
                        onClick={() => handleRetry(m.retryPrompt!)}
                        className="self-start rounded-full border border-red-400/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-red-200 transition hover:border-red-300 hover:text-red-100"
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </ChatBubble>
            );
            })}
          </div>
        </div>
        <footer className="sticky bottom-0 z-[2] pointer-events-auto border-t border-[color:var(--chat-border-soft)]/60 bg-[color:var(--chat-bg-app)]/92 px-6 pb-[calc(18px+var(--safe-bottom))] pt-4 backdrop-blur">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div
              ref={inputShellRef}
              className={`chat-input-shell flex flex-1 flex-col gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-end ${
                isShaking ? "chat-input-shell-shake" : ""
              }`}
              onAnimationEnd={() => setIsShaking(false)}
            >
              <textarea
                ref={inputRef}
                value={input}
                onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest" })}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitPrompt(event.currentTarget.value);
                  }
                }}
                className="max-h-40 flex-1 resize-none bg-transparent text-[15px] text-white/90 placeholder:text-[color:var(--chat-text-muted)] focus:outline-none"
                rows={1}
                placeholder="Ask about your expenses…"
                aria-label="Ask about your expenses"
              />
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                {info ? (
                  <span className="text-[11px] text-[color:var(--chat-text-muted)]" title={`${info.provider}/${info.model}`}>
                    {info.model}
                  </span>
                ) : null}
                <button
                  type="submit"
                  aria-label="Send message"
                  aria-disabled={isStreaming}
                  disabled={isStreaming}
                  className="min-h-[48px] rounded-full bg-[color:var(--chat-primary)] px-6 text-[14px] font-semibold text-black transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:bg-white/30"
                >
                  {isStreaming ? (
                    <span className="flex items-center gap-2 text-[14px] font-semibold">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
            </div>
          </form>
        </footer>
      </div>
    </Modal>
  );
}

