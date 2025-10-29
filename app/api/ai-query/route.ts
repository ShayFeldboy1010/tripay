import OpenAI from "openai";
import { NextRequest } from "next/server";
import type { AIQuery } from "@/lib/ai/schema";

const allowedKinds = new Set([
  "CompareCategories",
  "TotalByCategory",
  "TopCategories",
  "SpendByDay",
  "BudgetStatus",
]);

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OpenAI not configured" }), { status: 501 });
  }

  const { text, tripId } = await req.json();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content:
          "You are a deterministic parser. Input: a free-text question about the user's travel expenses.\nOutput: ONLY a JSON object that matches the TypeScript type AIQuery (from lib/ai/schema.ts).\nNo prose. No code fences. No extra keys.",
      },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
  });

  let plan: AIQuery;
  try {
    const content = completion.choices[0]?.message?.content || "";
    plan = JSON.parse(content);
    if (!allowedKinds.has((plan as any).kind)) {
      throw new Error("invalid kind");
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON from model" }), { status: 400 });
  }

  return Response.json({ plan });
}
