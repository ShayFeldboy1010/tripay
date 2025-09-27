export type AiChatAuthMode = "anonymous" | "jwt";

const raw = (process.env.NEXT_PUBLIC_AI_CHAT_AUTH_MODE || "anonymous").toLowerCase();

export const AI_CHAT_AUTH_MODE: AiChatAuthMode = raw === "jwt" ? "jwt" : "anonymous";
export const AI_CHAT_IS_JWT = AI_CHAT_AUTH_MODE === "jwt";
