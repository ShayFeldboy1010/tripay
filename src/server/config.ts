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
