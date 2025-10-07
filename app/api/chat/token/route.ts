import { NextRequest } from "next/server";
import { issueSseToken } from "@/src/server/auth/jwt";
import { buildHeaders } from "../_shared";

export async function OPTIONS(req: NextRequest) {
  const headers = buildHeaders(req);
  return new Response(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  const headers = buildHeaders(req);
  try {
    const body = (await req.json()) as { userId?: string | null; ttlSeconds?: number | null };
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const ttl = typeof body?.ttlSeconds === "number" && Number.isFinite(body.ttlSeconds)
      ? Math.max(60, Math.min(body.ttlSeconds, 900))
      : 300;
    const token = await issueSseToken(userId, { ttlSeconds: ttl, userId });
    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-chat] token_issue_failed", err);
    return new Response(JSON.stringify({ error: "Unable to issue token" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}
