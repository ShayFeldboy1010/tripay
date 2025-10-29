import OpenAI from "openai";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "openai/gpt-oss-120b";
const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  const baseURL = process.env.OPENAI_BASE_URL;
  cachedClient = new OpenAI({ apiKey, baseURL });
  return cachedClient;
}

export function getOpenAIModels() {
  return {
    primary: DEFAULT_MODEL,
    fallback: FALLBACK_MODEL,
  };
}
