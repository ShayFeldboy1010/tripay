"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Expense, Trip } from "@/lib/supabase/client";
import { answerQuestion } from "@/services/nlq/answerQuestion";
import type { Answer } from "@/services/nlq/dsl";
import clsx from "clsx";

export function AiAssistant({ expenses, trip, className, inputRef }: { expenses: Expense[]; trip: Trip; className?: string; inputRef?: React.RefObject<HTMLInputElement> }) {
  const [text, setText] = useState("");
  const [useGroq, setUseGroq] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  const suggestions = [
    "מלונות או תחבורה?",
    "כמה על אוכל אתמול?",
    "Top categories",
    "Daily spend",
    "מצב התקציב היום",
  ];

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const ans = await answerQuestion(text, {
        baseCurrency: trip.base_currency || undefined,
        expenses,
        useGroq,
      });
      setAnswer(ans);
      setShowDetails(false);
      if (ans.warnings && ans.warnings.length) {
        ans.warnings.forEach((w) => toast(w));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestion(s: string) {
    setText(s);
    handleSubmit();
  }

  return (
    <div className={clsx("space-y-2", className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            aria-label="Ask about your spend"
            value={text}
            onChange={(e) => setText(e.target.value)}
            dir="auto"
            className="flex-1"
          />
        <Button type="submit" disabled={loading}>
          Ask
        </Button>
      </form>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={useGroq} onChange={(e) => setUseGroq(e.target.checked)} />
        Use Groq AI parsing (beta)
      </label>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Button key={s} type="button" variant="secondary" size="sm" onClick={() => handleSuggestion(s)}>
            {s}
          </Button>
        ))}
      </div>
      <div className="min-h-[4rem] mt-2">
        {answer && (
          <div>
            <p dir="auto" dangerouslySetInnerHTML={{ __html: answer.text }} />
            {answer.details && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails((p) => !p)}
              >
                {showDetails ? "Hide details" : "Show details"}
              </Button>
            )}
            {showDetails && answer.details && (
              <pre className="mt-2 text-xs overflow-auto max-h-40">
                {JSON.stringify(answer.details, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
