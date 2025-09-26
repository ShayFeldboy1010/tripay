"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { DateTime } from "luxon";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import {
  buildExpensesStreamUrl,
  type ExpensesChatMetaEvent,
  type ExpensesChatResult,
} from "@/services/ai/askAI";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useSSE } from "@/hooks/useSSE";
import { ChatBubble } from "./ai-chat/ChatBubble";
import { useAIChat } from "./AIChatStore";

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

function parseStreamEvent(rawEvent: { event: string; data: string }) {
  try {
    switch (rawEvent.event) {
      case "meta":
        return { type: "meta" as const, data: JSON.parse(rawEvent.data) as ExpensesChatMetaEvent };
      case "token":
        return { type: "token" as const, data: rawEvent.data };
      case "result":
        return { type: "result" as const, data: JSON.parse(rawEvent.data) as ExpensesChatResult };
      case "error":
        return { type: "error" as const, data: JSON.parse(rawEvent.data) as { message?: string } };
      case "ping":
        return { type: "ping" as const, data: {} };
      default:
        return null;
    }
  } catch (err) {
    console.error("ai-chat: failed to parse event", rawEvent, err);
    return null;
  }
}

export function AIChatPanel({ tripId, open }: { tripId: string; open: boolean }) {
  const isDesktop = useIsDesktop();
  const { messages, addMessage, updateLastMessage, close, meta, setMeta } = useAIChat();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [activeRange, setActiveRange] = useState<{ id: RangeOptionId; since: string; until: string } | null>(null);
  const [timezone, setTimezone] = useState<string>("Asia/Seoul");
  const [userId, setUserId] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const sse = useSSE({ pingEventName: "ping", fallbackToFetch: true });

  const msgs = messages[tripId] || [];

  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) {
      setTimezone(resolved);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      sse.close();
      return;
    }
    const defaultRange = RANGE_OPTIONS[0];
    const computed = defaultRange.compute(timezone);
    setActiveRange({ id: defaultRange.id, ...computed });
    setTimeout(() => inputRef.current?.focus(), 180);
  }, [open, timezone, sse]);

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

  const handleSseEvent = useCallback(
    (raw: { event: string; data: string }) => {
      const event = parseStreamEvent(raw);
      if (!event) return;
      switch (event.type) {
        case "meta":
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, meta: event.data, reconnecting: false };
          });
          break;
        case "token":
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, text: prev.text + event.data, streaming: true, reconnecting: false };
          });
          break;
        case "result":
          setMeta(tripId, { provider: event.data.provider, model: event.data.model });
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, text: event.data.answer.trim(), streaming: false, result: event.data, reconnecting: false };
          });
          sse.stopReconnecting();
          break;
        case "error":
          toast.error(event.data.message ?? "Connection interrupted. Trying again…");
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, reconnecting: true };
          });
          break;
        case "ping":
        default:
          break;
      }
    },
    [setMeta, sse, tripId, updateLastMessage]
  );

  const send = useCallback(async () => {
    if (!input.trim()) return;
    if (!activeRange) {
      toast.error("Select a time range first");
      return;
    }
    if (!userId) {
      toast.error("You need to be signed in to use AI chat");
      return;
    }

    const question = input.trim();
    setInput("");
    addMessage(tripId, { role: "user", text: question });
    addMessage(tripId, { role: "assistant", text: "", streaming: true });

    try {
      setTokenLoading(true);
      const token = await fetchSseToken(userId);
      const url = buildExpensesStreamUrl({
        question,
        since: activeRange.since,
        until: activeRange.until,
        timezone,
        token,
      });

      sse.connect({
        url,
        onEvent: handleSseEvent,
        onOpen: () => {
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, reconnecting: false };
          });
        },
        onError: (err) => {
          console.warn("ai-chat: stream error", err);
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, reconnecting: true };
          });
          toast.error("Network interrupted. Reconnecting…");
        },
      });
    } catch (err) {
      console.error("ai-chat: failed to start stream", err);
      toast.error("Unable to start AI chat");
      updateLastMessage(tripId, (prev) => {
        if (prev.role !== "assistant") return prev;
        return {
          ...prev,
          streaming: false,
          text: "We couldn't reach the AI right now. Please try again shortly.",
          error: "startup",
        };
      });
    } finally {
      setTokenLoading(false);
    }
  }, [activeRange, addMessage, handleSseEvent, input, timezone, sse, tripId, updateLastMessage, userId]);

  const overlayClasses = isDesktop
    ? "fixed inset-y-0 right-0 flex max-w-full justify-end"
    : "fixed inset-0 flex max-w-full";

  return (
    <div className={overlayClasses} style={{ display: open ? "flex" : "none" }}>
      <div className="chat-panel-overlay absolute inset-0" onClick={close} />
      <div
        className="chat-panel relative z-[10000] flex h-full w-full max-w-[560px] flex-col border-l border-[color:var(--chat-border-soft)]/60"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[color:var(--chat-border-soft)]/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--chat-primary)]/15 text-[color:var(--chat-primary)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">AI Expenses</h2>
              <p className="text-[13px] text-[color:var(--chat-text-muted)]">Ask grounded questions about this trip&apos;s spending.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close chat"
            onClick={close}
            className="rounded-full border border-[color:var(--chat-border-soft)]/80 bg-black/30 p-2 text-[color:var(--chat-text-muted)] transition hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => {
              const active = activeRange?.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleRangeClick(option)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
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
        <div ref={listRef} className="chat-scroll-area flex-1 space-y-4 overflow-y-auto px-6 pb-8">
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
                {m.error ? <p className="mt-3 text-[12px] text-red-400">{m.error}</p> : null}
              </ChatBubble>
            );
          })}
        </div>
        <footer className="safe-area-pb border-t border-[color:var(--chat-border-soft)]/60 px-6 py-5">
          <div className="chat-input-shell flex items-end gap-3 rounded-2xl px-4 py-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              className="max-h-40 flex-1 resize-none bg-transparent text-[15px] text-white/90 placeholder:text-[color:var(--chat-text-muted)] focus:outline-none"
              rows={1}
              placeholder="Ask about your expenses…"
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || tokenLoading || sse.isConnecting}
              className="rounded-full bg-[color:var(--chat-primary)] px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/30"
            >
              Send
            </button>
            {info ? (
              <span className="text-[11px] text-[color:var(--chat-text-muted)]" title={`${info.provider}/${info.model}`}>
                {info.model}
              </span>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

