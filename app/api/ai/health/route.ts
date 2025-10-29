import { NextResponse } from "next/server";

export async function GET() {
  const provider = process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "mock");
  const model = process.env.LLM_MODEL || (provider === "openai" ? "openai/gpt-oss-120b" : "mock-model");
  return NextResponse.json({ provider, model, ok: true });
}
