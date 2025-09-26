import { jwtVerify } from "jose";

export async function verifyAndExtractUserId(token: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for authentication");
  const encoder = new TextEncoder();
  const { payload } = await jwtVerify(token, encoder.encode(secret));
  const userId = typeof payload.sub === "string" ? payload.sub : typeof payload.userId === "string" ? payload.userId : null;
  if (!userId) {
    throw new Error("JWT missing user identifier");
  }
  return userId;
}

