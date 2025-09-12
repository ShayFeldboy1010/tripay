"use client";
import { useState, useRef } from "react";
import { X } from "lucide-react";
import { useTheme } from "@/theme/ThemeProvider";
import { askAI } from "@/services/ai/askAI";
import { Answer } from "@/services/nlq/dsl";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface Msg { role: "user" | "assistant"; text: string }

export function AIChatPanel({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const { colors } = useTheme();
  const isDesktop = useIsDesktop();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  async function send() {
    if (!input.trim()) return;
    const q = input;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    try {
      const ans: Answer = await askAI(q, { tripId });
      setMessages((m) => [...m, { role: "assistant", text: ans.text }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "I couldn’t reach the AI. Try again." }]);
    }
    setTimeout(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight), 0);
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col h-full bg-[color:var(--color-surface)]"
        style={
          isDesktop
            ? { width: 400, left: 0, top: 0, bottom: 0, position: "absolute" }
            : { position: "absolute", inset: 0 }
        }
      >
        <header
          className="p-4 flex items-center justify-between"
          style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
        >
          <div>
            <h2 className="text-lg font-semibold">AI Assistant</h2>
            <p className="text-xs opacity-80">Ask about your expenses</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-1" style={{ color: colors.onPrimary }}>
            <X className="w-5 h-5" />
          </button>
        </header>
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "text-right" : "text-left"}
              dir="auto"
            >
              <div
                className={`inline-block px-3 py-2 rounded-lg text-sm ${
                  m.role === "user" ? "bg-[color:var(--color-primary50)]" : "bg-[color:var(--color-surface)]"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            dir="auto"
            className="flex-1 border rounded px-2 py-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
            className="px-3 py-1 rounded"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
