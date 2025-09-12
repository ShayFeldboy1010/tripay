export interface AskAIResponse {
  answer: string;
  modelUsed: string;
  provider: string;
  requestId: string;
}

export async function askAI(
  question: string,
  ctx: { tripId: string; locale: string; timezone: string },
): Promise<AskAIResponse> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      tripId: ctx.tripId,
      locale: ctx.locale,
      timezone: ctx.timezone,
    }),
  });
  if (!res.ok) {
    throw new Error("AI request failed");
  }
  return res.json();
}
