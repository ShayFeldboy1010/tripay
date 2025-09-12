import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { answerQuestion } from "@/services/nlq/answerQuestion";
import { createLLM, LLMProvider } from "@/src/server/llm/provider";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { question, tripId, locale, timezone } = await req.json();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).single();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("trip_id", tripId);

  const provider = (process.env.LLM_PROVIDER as LLMProvider) || "moonshot";
  const model = process.env.LLM_MODEL || "moonshotai/kimi-k2-instruct-0905";
  const baseUrl = provider === "moonshot" ? process.env.MOONSHOT_BASE_URL : process.env.GROQ_BASE_URL;
  const apiKey = provider === "moonshot" ? process.env.MOONSHOT_API_KEY : process.env.GROQ_API_KEY;
  const _llm = createLLM({ provider, model, baseUrl, apiKey });

  const promptHash = crypto.createHash("sha256").update(question).digest("hex").slice(0, 8);
  console.log(`ai-chat provider=${provider} model=${model} prompt=${promptHash}`);

  const ans = await answerQuestion(question, {
    baseCurrency: trip?.base_currency || undefined,
    expenses: expenses || [],
  });

  const requestId = crypto.randomUUID();
  const headers = new Headers();
  headers.set("X-LLM-Provider", provider);
  headers.set("X-LLM-Model", model);
  return new NextResponse(
    JSON.stringify({ answer: ans.text, modelUsed: model, provider, requestId }),
    { headers }
  );
}
