import { NextResponse } from "next/server";

export async function GET() {
  const provider = process.env.LLM_PROVIDER || "moonshot";
  const model = process.env.LLM_MODEL || "moonshotai/kimi-k2-instruct-0905";
  return NextResponse.json({ provider, model, ok: true });
}
