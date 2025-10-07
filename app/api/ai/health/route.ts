import { NextResponse } from "next/server";

export async function GET() {
  const provider = process.env.LLM_PROVIDER || (process.env.GROQ_API_KEY ? "groq" : "mock");
  const model = process.env.LLM_MODEL || (provider === "groq" ? "llama-3.1-8b-instant" : "mock-model");
  return NextResponse.json({ provider, model, ok: true });
}
