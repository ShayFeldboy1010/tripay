import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { answerQuestion } from "@/services/nlq/answerQuestion";
import { createLLM, resolveLLMConfig } from "@/src/server/llm/provider";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { question, tripId, locale, timezone } = await req.json();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).single();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("trip_id", tripId);

  const llmConfig = resolveLLMConfig();
  if (llmConfig.provider !== "mock" && llmConfig.apiKey) {
    createLLM(llmConfig);
  }

  const promptHash = crypto.createHash("sha256").update(question).digest("hex").slice(0, 8);
  console.log(
    `ai-chat provider=${llmConfig.provider} model=${llmConfig.model} prompt=${promptHash}`
  );

  const ans = await answerQuestion(question, {
    baseCurrency: trip?.base_currency || undefined,
    expenses: expenses || [],
  });

  const requestId = crypto.randomUUID();
  const headers = new Headers();
  headers.set("X-LLM-Provider", llmConfig.provider);
  headers.set("X-LLM-Model", llmConfig.model);
  return new NextResponse(
    JSON.stringify({
      answer: ans.text,
      modelUsed: llmConfig.model,
      provider: llmConfig.provider,
      requestId,
    }),
    { headers }
  );
}
