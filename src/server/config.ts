const RAW_MODE = (process.env.AI_CHAT_AUTH_MODE || "anonymous").toLowerCase();

export type AiChatAuthMode = "anonymous" | "jwt";

const VALID_MODES: AiChatAuthMode[] = ["anonymous", "jwt"];

const RESOLVED_MODE: AiChatAuthMode = VALID_MODES.includes(RAW_MODE as AiChatAuthMode)
  ? (RAW_MODE as AiChatAuthMode)
  : "anonymous";

if (process.env.NODE_ENV !== "test") {
  console.info(`[ai-chat] auth mode: ${RESOLVED_MODE}`);
}

export const AI_CHAT_AUTH_MODE: AiChatAuthMode = RESOLVED_MODE;
export const AI_CHAT_IS_ANONYMOUS = RESOLVED_MODE === "anonymous";

const DEFAULT_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL?.trim(),
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter((value): value is string => Boolean(value));

function parseAllowedOrigins() {
  const raw = process.env.AI_CHAT_ALLOWED_ORIGINS ?? "";
  const split = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (split.length > 0) {
    return Array.from(new Set(split));
  }
  return Array.from(new Set(DEFAULT_ORIGINS));
}

export const AI_CHAT_ALLOWED_ORIGINS = parseAllowedOrigins();

export function resolveAllowedOrigin(origin: string | null | undefined): string {
  if (origin && AI_CHAT_ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return AI_CHAT_ALLOWED_ORIGINS[0] ?? "http://localhost:3000";
}
