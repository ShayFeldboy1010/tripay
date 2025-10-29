export type LLMProvider = "openai" | "mock";

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

import OpenAI from "openai";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "openai/gpt-oss-120b",
  mock: "mock-model",
};

export function resolveLLMConfig(): LLMConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  const envProvider = (process.env.LLM_PROVIDER as LLMProvider | undefined) ?? (apiKey ? "openai" : undefined);
  const provider: LLMProvider = envProvider === "openai" && apiKey ? "openai" : "mock";
  const envModel = process.env.LLM_MODEL?.trim();
  const model = envModel && envModel.length > 0 ? envModel : DEFAULT_MODELS[provider];
  const baseUrl = process.env.OPENAI_BASE_URL;
  return { provider, model, baseUrl, apiKey };
}

class OpenAILLM implements LLMClient {
  private client: OpenAI;
  private model: string;
  constructor(cfg: LLMConfig) {
    const options: { apiKey?: string; baseURL?: string } = { apiKey: cfg.apiKey };
    if (cfg.baseUrl) options.baseURL = cfg.baseUrl;
    this.client = new OpenAI(options);
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
    case "openai":
      return new OpenAILLM(cfg);
    default:
      return new MockLLM();
  }
}
