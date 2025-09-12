import { LLMClient, LLMConfig } from "./provider";

export class MoonshotLLM implements LLMClient {
  private model: string;
  private baseUrl: string;
  private apiKey?: string;
  constructor(cfg: LLMConfig) {
    this.model = cfg.model;
    this.baseUrl = cfg.baseUrl || "https://api.moonshot.cn/v1";
    this.apiKey = cfg.apiKey;
  }
  async chatCompletion(payload: {
    system: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
  }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "system", content: payload.system }, ...payload.messages],
        temperature: 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return data.choices?.[0]?.message?.content || "";
  }
}
