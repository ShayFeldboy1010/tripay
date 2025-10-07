import { NextRequest } from "next/server";
import { issueSseToken } from "@/src/server/auth/jwt";
import { buildHeaders, errorResponse } from "../_shared";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUuid(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new Error("invalid id format");
  }
  return trimmed;
}

export async function OPTIONS(req: NextRequest) {
  const headers = buildHeaders(req);
  return new Response(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  const headers = buildHeaders(req);
  try {
    const body = (await req.json()) as {
      tripId?: unknown;
      userId?: unknown;
      ttlSeconds?: unknown;
    } | null;

    const claims: { tripId?: string; userId?: string } = {};
    if (body?.tripId) claims.tripId = normalizeUuid(body.tripId);
    if (body?.userId) claims.userId = normalizeUuid(body.userId);

    const ttl = typeof body?.ttlSeconds === "number" && Number.isFinite(body.ttlSeconds)
      ? Math.max(60, Math.min(body.ttlSeconds, 900))
      : 300;

    const token = await issueSseToken("guest", {
      ttlSeconds: ttl,
      tripId: claims.tripId ?? null,
      userId: claims.userId ?? null,
    });

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "invalid id format") {
      return errorResponse(headers, 400, "AI-400", "Invalid id format");
    }
    console.error("[ai-chat] guest-token-failed", err);
    return errorResponse(headers, 500, "AI-500", "Unable to issue token");
  }
}
