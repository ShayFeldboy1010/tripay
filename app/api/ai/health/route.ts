import { NextResponse } from "next/server";
import { resolveLLMConfig } from "@/src/server/llm/provider";

export async function GET() {
  const cfg = resolveLLMConfig();
  return NextResponse.json({ provider: cfg.provider, model: cfg.model, ok: true });
}
