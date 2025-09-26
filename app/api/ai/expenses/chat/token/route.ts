import { NextRequest } from "next/server";
import { issueSseToken } from "@/src/server/auth/jwt";

function buildCorsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Type, Cache-Control",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const headers = buildCorsHeaders(req);
  try {
    const body = (await req.json()) as { userId?: string; ttlSeconds?: number };
    if (!body?.userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const token = await issueSseToken(body.userId, Math.min(body.ttlSeconds ?? 300, 900));
    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-chat-token: failed", err);
    return new Response(JSON.stringify({ error: "Unable to issue token" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}

