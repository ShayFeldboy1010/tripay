export type LLMProvider = "groq" | "mock";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface LLMClient {
  chatCompletion(payload: {
    system: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
  }): Promise<string>;
}

import Groq from "groq-sdk";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  groq: "llama-3.1-8b-instant",
  mock: "mock-model",
};

export function resolveLLMConfig(): LLMConfig {
  const apiKey = process.env.GROQ_API_KEY;
  const envProvider = (process.env.LLM_PROVIDER as LLMProvider | undefined) ?? (apiKey ? "groq" : undefined);
  const provider: LLMProvider = envProvider === "groq" && apiKey ? "groq" : "mock";
  const envModel = process.env.LLM_MODEL?.trim();
  const model = envModel && envModel.length > 0 ? envModel : DEFAULT_MODELS[provider];
  const baseUrl = process.env.GROQ_BASE_URL;
  return { provider, model, baseUrl, apiKey };
}

class GroqLLM implements LLMClient {
  private client: Groq;
  private model: string;
  constructor(cfg: LLMConfig) {
    const options: { apiKey?: string; baseURL?: string } = { apiKey: cfg.apiKey };
    if (cfg.baseUrl) options.baseURL = cfg.baseUrl;
    this.client = new Groq(options);
    this.model = cfg.model;
  }
  async chatCompletion(payload: {
    system: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
  }): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: payload.system },
        ...payload.messages,
      ],
      temperature: 0,
    });
    return res.choices[0]?.message?.content || "";
  }
}

class MockLLM implements LLMClient {
  async chatCompletion(): Promise<string> {
    return "mock";
  }
}

export function createLLM(cfg: LLMConfig): LLMClient {
  switch (cfg.provider) {
    case "groq":
      return new GroqLLM(cfg);
    default:
      return new MockLLM();
  }
}
