"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Expense, Trip } from "@/lib/supabase/client";
import { parseAIQuery } from "@/lib/ai/parse-intent";
import { executeAIQuery } from "@/lib/ai/execute";
import type { AIAnswer, AIQuery } from "@/lib/ai/schema";
import clsx from "clsx";

export function AiAssistant({ expenses, trip, className }: { expenses: Expense[]; trip: Trip; className?: string }) {
  const [text, setText] = useState("");
  const [useGroq, setUseGroq] = useState(false);
  const [answer, setAnswer] = useState<AIAnswer | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  const suggestions = [
    "Which is higher: hotels or transportation this month?",
    "How much on food yesterday?",
    "Top categories last week",
    "Daily spend this month",
    "Budget status today",
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
      setAnswer(ans);
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
            <p dir="auto">{answer.text}</p>
            <Button variant="ghost" size="sm" onClick={() => setShowDetails((p) => !p)}>
              {showDetails ? "Hide details" : "Show details"}
            </Button>
            {showDetails && (
              <div className="mt-2 space-y-2">
                {answer.facts.length > 0 && (
                  <table className="text-sm">
                    <tbody>
                      {answer.facts.map((f) => (
                        <tr key={f.label}>
                          <td className="pr-2 text-gray-500" dir="auto">
                            {f.label}
                          </td>
                          <td dir="ltr">{f.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(answer.plan, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
