"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Expense, Trip } from "@/lib/supabase/client";
import { parseAIQuery } from "@/lib/ai/parse-intent";
import { executeAIQuery } from "@/lib/ai/execute";
import { composeAnswer } from "@/lib/ai/compose";
import type { AIQuery, AIFact } from "@/lib/ai/schema";
import clsx from "clsx";

export function AiAssistant({ expenses, trip, className }: { expenses: Expense[]; trip: Trip; className?: string }) {
  const [text, setText] = useState("");
  const [useGroq, setUseGroq] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; facts: AIFact[] } | null>(null);
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
      let plan: AIQuery | null = null;
      if (useGroq) {
        try {
          const res = await fetch("/api/ai-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, tripId: trip.id }),
          });
          if (res.ok) {
            const data = await res.json();
            plan = data.plan as AIQuery;
          } else {
            console.error("Groq error", await res.text());
            toast("AI parsing failed, using local rules");
          }
        } catch (err) {
          console.error(err);
          toast("AI parsing failed, using local rules");
        }
      }
      if (!plan) {
        plan = parseAIQuery(text);
      }
      const ans = executeAIQuery(plan, { expenses, trip });
      const text = composeAnswer(plan, ans, { currency: trip.base_currency || undefined });
      setAnswer({ text, facts: ans.facts });
      setShowDetails(false);
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
            {answer.facts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails((p) => !p)}
              >
                {showDetails ? "Hide details" : "Show details"}
              </Button>
            )}
            {showDetails && answer.facts.length > 0 && (
              <ul className="mt-2 list-disc ml-4 text-sm space-y-1">
                {answer.facts.map((f) => (
                  <li key={f.label} dir="auto">
                    {f.label}: <span dir="ltr">{f.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
