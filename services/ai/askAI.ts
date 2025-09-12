import type { Answer } from "@/services/nlq/dsl";

export async function askAI(question: string, ctx: { tripId: string; baseCurrency?: string }): Promise<Answer> {
  const res = await fetch("/api/ai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, tripId: ctx.tripId, baseCurrency: ctx.baseCurrency }),
  });
  if (!res.ok) {
    return { text: "I couldn’t reach the AI. Try again." };
  }
  return res.json();
}
