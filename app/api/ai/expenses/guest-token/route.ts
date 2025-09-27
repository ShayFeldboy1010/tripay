import { NextRequest } from "next/server";
import { issueSseToken } from "@/src/server/auth/jwt";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Type, Cache-Control",
    Vary: "Origin",
  } as Record<string, string>;
}

function normalizeUuid(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new Error("invalid id format");
  }
  return trimmed;
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: buildHeaders(req) });
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
    if (body?.tripId) {
      claims.tripId = normalizeUuid(body.tripId);
    }
    if (body?.userId) {
      claims.userId = normalizeUuid(body.userId);
    }

    const ttl = typeof body?.ttlSeconds === "number" && Number.isFinite(body.ttlSeconds) ? body.ttlSeconds : 300;
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
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    console.error("guest-token: failed", err);
    return new Response(JSON.stringify({ error: "Unable to issue token" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}
