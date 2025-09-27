import { SignJWT, jwtVerify } from "jose";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for authentication");
  return new TextEncoder().encode(secret);
}

export async function verifyAndExtractUserId(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getSecret());
  const userId = typeof payload.sub === "string" ? payload.sub : typeof payload.userId === "string" ? payload.userId : null;
  if (!userId) {
    throw new Error("JWT missing user identifier");
  }
  return userId;
}

interface IssueSseTokenOptions {
  ttlSeconds?: number;
  tripId?: string | null;
  userId?: string | null;
}

export async function issueSseToken(subject: string, options: IssueSseTokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = { scope: "ai_chat" };
  if (options.tripId) {
    payload.trip_id = options.tripId;
  }
  if (options.userId) {
    payload.user_id = options.userId;
  }

  const jwt = new SignJWT(payload)
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + Math.min(Math.max(options.ttlSeconds ?? 300, 60), 3600))
    .setProtectedHeader({ alg: "HS256" });

  return await jwt.sign(getSecret());
}

export interface VerifiedSseToken {
  subject: string;
  tripId?: string;
  userId?: string;
}

export async function verifySseToken(token: string): Promise<VerifiedSseToken> {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.scope !== "ai_chat") {
    throw new Error("Invalid token scope");
  }
  const subject = typeof payload.sub === "string" ? payload.sub : undefined;
  if (!subject) throw new Error("Token missing subject");

  const tripId = typeof (payload as Record<string, unknown>).trip_id === "string" ? ((payload as Record<string, unknown>).trip_id as string) : undefined;
  const userId = typeof (payload as Record<string, unknown>).user_id === "string" ? ((payload as Record<string, unknown>).user_id as string) : undefined;

  return { subject, tripId, userId };
}

