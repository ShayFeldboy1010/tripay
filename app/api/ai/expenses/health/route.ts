import { NextResponse } from "next/server";
import { getGroqClient, getGroqModels } from "@/services/ai-expenses/groq";
import { query } from "@/src/server/db/pool";
import { AI_CHAT_AUTH_MODE, AI_CHAT_IS_ANONYMOUS } from "@/src/server/config";

export const runtime = "nodejs";

export async function GET() {
  const envsPresent = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
  } as const;

  let supabaseOk = false;
  let supabaseError: string | null = null;
  if (!envsPresent.DATABASE_URL) {
    supabaseError = "DATABASE_URL missing";
  } else {
    try {
      const { rows } = await query<{ ok: number }>("select 1 as ok");
      supabaseOk = rows.length > 0;
    } catch (err) {
      supabaseError = err instanceof Error ? err.message : String(err);
    }
  }

  let llmOk = false;
  let llmError: string | null = null;
  if (!envsPresent.GROQ_API_KEY) {
    llmError = "GROQ_API_KEY missing";
  } else {
    try {
      const client = getGroqClient();
      const { primary } = getGroqModels();
      await client.models.retrieve(primary);
      llmOk = true;
    } catch (err) {
      llmError = err instanceof Error ? err.message : String(err);
    }
  }

  const policy = {
    authMode: AI_CHAT_AUTH_MODE,
    allowAnonymous: AI_CHAT_IS_ANONYMOUS,
  } as const;

  const status = supabaseOk && llmOk ? 200 : 503;

  return NextResponse.json(
    {
      supabase: { ok: supabaseOk, error: supabaseError },
      llm: { ok: llmOk, error: llmError },
      policy,
      envsPresent,
    },
    { status }
  );
}
