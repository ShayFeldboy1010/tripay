import Groq from "groq-sdk";

const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.1-70b-versatile";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

let cachedClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required");
  }
  cachedClient = new Groq({ apiKey });
  return cachedClient;
}

export function getGroqModels() {
  return {
    primary: DEFAULT_MODEL,
    fallback: FALLBACK_MODEL,
  };
}

