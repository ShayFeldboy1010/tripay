"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { DateTime } from "luxon";
import { useTheme } from "@/theme/ThemeProvider";
import { streamExpensesAI, type ExpensesChatResult } from "@/services/ai/askAI";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAIChat } from "./AIChatStore";

type RangeOptionId = "thisMonth" | "last7" | "lastMonth" | "ytd";

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
    label: "YTD",
    compute: (zone) => {
      const now = DateTime.now().setZone(zone);
      return { since: now.startOf("year").toISODate()!, until: now.toISODate()! };
    },
  },
];

function ResultDataPanel({ result }: { result: ExpensesChatResult }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);
  return (
    <div className="mt-2 text-xs">
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
        onClick={toggle}
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Data
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm">
          <section>
            <h4 className="text-[10px] uppercase tracking-wide text-gray-500">SQL</h4>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-2 text-[11px]">
              {result.sql}
            </pre>
          </section>
          <section className="text-[11px] text-gray-600">
            <span className="font-medium">Time range:</span> {result.timeRange.since} → {result.timeRange.until} ({result.timeRange.tz})
          </section>
          <section className="space-y-1">
            <h4 className="text-[10px] uppercase tracking-wide text-gray-500">Totals</h4>
            {result.aggregates.totalsByCurrency.length === 0 ? (
              <p className="text-[11px] text-gray-600">No matching rows.</p>
            ) : (
              <ul className="space-y-1">
                {result.aggregates.totalsByCurrency.map((item) => (
                  <li key={item.currency} className="text-[11px] text-gray-700">
                    {item.currency}: {item.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({item.count} tx)
                  </li>
                ))}
              </ul>
            )}
          </section>
          {result.aggregates.byMerchant.length > 0 && (
            <section>
              <h4 className="text-[10px] uppercase tracking-wide text-gray-500">Top merchants</h4>
              <ul className="mt-1 space-y-1">
                {result.aggregates.byMerchant.slice(0, 5).map((item) => (
                  <li key={`${item.currency}-${item.merchant}`} className="text-[11px] text-gray-700">
                    {item.merchant} — {item.currency} {item.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h4 className="text-[10px] uppercase tracking-wide text-gray-500">Rows</h4>
            <div className="mt-1 max-h-56 overflow-auto">
              <table className="w-full min-w-[280px] text-[11px]">
                <thead className="sticky top-0 bg-gray-100 text-gray-600">
                  <tr>
                    <th className="px-1 py-1 text-left">Date</th>
                    <th className="px-1 py-1 text-left">Amount</th>
                    <th className="px-1 py-1 text-left">Category</th>
                    <th className="px-1 py-1 text-left">Merchant</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 20).map((row, idx) => (
                    <tr key={`${row.date}-${row.merchant}-${idx}`} className="odd:bg-white even:bg-gray-50">
                      <td className="px-1 py-1 text-gray-700">{row.date}</td>
                      <td className="px-1 py-1 text-gray-700">
                        {row.currency} {Number(row.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-1 py-1 text-gray-600">{row.category ?? "—"}</td>
                      <td className="px-1 py-1 text-gray-600">{row.merchant ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function AIChatPanel({ tripId, open }: { tripId: string; open: boolean }) {
  const { colors } = useTheme();
  const isDesktop = useIsDesktop();
  const { messages, addMessage, updateLastMessage, close, meta, setMeta } = useAIChat();
  const msgs = messages[tripId] || [];
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<{ close: () => void } | null>(null);
  const [activeRange, setActiveRange] = useState<{ id: RangeOptionId | null; since?: string; until?: string }>({
    id: "thisMonth",
  });
  const [error, setError] = useState<string | null>(null);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul", []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      streamRef.current?.close();
      streamRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (activeRange.id) {
      const option = RANGE_OPTIONS.find((opt) => opt.id === activeRange.id);
      if (option) {
        const range = option.compute(timezone);
        setActiveRange({ id: option.id, ...range });
      }
    }
  }, [timezone, open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight });
      }
    });
  }, [msgs, open]);

  const info = meta[tripId];

  const handleChipClick = (option: RangeOption) => {
    const range = option.compute(timezone);
    setActiveRange({ id: option.id, ...range });
  };

  async function send() {
    if (!input.trim()) return;
    const question = input.trim();
    setInput("");
    setError(null);

    addMessage(tripId, { role: "user", text: question });
    addMessage(tripId, { role: "assistant", text: "", streaming: true });
    streamRef.current?.close();

    const stream = streamExpensesAI(
      question,
      { since: activeRange.since, until: activeRange.until, timezone },
      {
        onToken(token) {
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, text: prev.text + token, streaming: true };
          });
        },
        onResult(result) {
          setMeta(tripId, { provider: result.provider, model: result.model });
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return { ...prev, text: result.answer.trim(), streaming: false, result };
          });
          streamRef.current = null;
        },
        onError(err) {
          setError(err.message);
          updateLastMessage(tripId, (prev) => {
            if (prev.role !== "assistant") return prev;
            return {
              ...prev,
              text: "Something went wrong. Please try again.",
              streaming: false,
              error: err.message,
            };
          });
          streamRef.current = null;
        },
      },
    );

    streamRef.current = stream;
  }

  return (
    <div className="fixed inset-0 z-[9999]" style={{ display: open ? "block" : "none" }} onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full flex-col bg-[color:var(--color-surface)]"
        style={
          isDesktop
            ? { width: 420, left: 0, top: 0, bottom: 0, position: "absolute" }
            : { position: "absolute", inset: 0 }
        }
      >
        <header
          className="flex items-center justify-between p-4"
          style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
        >
          <div>
            <h2 className="text-lg font-semibold">AI Expenses</h2>
            <p className="text-xs opacity-80">{/* TODO(shay): add localized helper copy */}Ask natural questions about this trip</p>
          </div>
          <button
            aria-label="Close"
            onClick={close}
            className="rounded p-1 transition hover:bg-black/10"
            style={{ color: colors.onPrimary }}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3" ref={listRef}>
          <div className="mb-3 flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => {
              const active = activeRange.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleChipClick(option)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {msgs.map((m, i) => (
            <div key={i} className={`mb-4 flex ${m.role === "user" ? "justify-end" : "justify-start"}`} dir="auto">
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  m.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-900"
                }`}
              >
                {m.role === "assistant" && m.streaming && (
                  <span className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-blue-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {/* TODO(shay): add localized helper copy */}Drafting answer
                  </span>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text || (m.role === "assistant" ? "…" : "")}</p>
                {m.role === "assistant" && m.result && <ResultDataPanel result={m.result} />}
                {m.role === "assistant" && m.error && (
                  <p className="mt-2 text-xs text-red-600">{m.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <footer className="border-t border-gray-200 bg-white p-4">
          {activeRange.since && activeRange.until && (
            <p className="mb-2 text-[11px] text-gray-500">
              {/* TODO(shay): add localized helper copy */}Filtering {activeRange.since} → {activeRange.until} ({timezone})
            </p>
          )}
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              dir="auto"
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              // TODO(shay): add localized helper copy
              placeholder="Ask about your expenses..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              onClick={send}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={!input.trim()}
            >
              Send
            </button>
            <span
              className="text-[10px] text-gray-400"
              title={info ? `${info.provider}/${info.model}` : undefined}
            >
              ⓘ
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

