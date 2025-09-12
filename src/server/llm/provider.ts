export type LLMProvider = "moonshot" | "groq" | "mock";

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

import { MoonshotLLM } from "./moonshot";
import Groq from "groq-sdk";

class GroqLLM implements LLMClient {
  private client: Groq;
  private model: string;
  constructor(cfg: LLMConfig) {
    this.client = new Groq({ apiKey: cfg.apiKey });
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
    case "moonshot":
      return new MoonshotLLM(cfg);
    case "groq":
      return new GroqLLM(cfg);
    default:
      return new MockLLM();
  }
}
