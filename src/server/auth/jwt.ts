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

export async function issueSseToken(userId: string, ttlSeconds = 300): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ scope: "ai_chat" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setProtectedHeader({ alg: "HS256" })
    .sign(getSecret());
}

export async function verifySseToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.scope !== "ai_chat") {
    throw new Error("Invalid token scope");
  }
  const userId = typeof payload.sub === "string" ? payload.sub : undefined;
  if (!userId) throw new Error("Token missing subject");
  return userId;
}

