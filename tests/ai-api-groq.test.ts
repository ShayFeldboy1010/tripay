import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

import { POST } from "@/app/api/ai-query/route";

describe("api/ai-query", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns plan on success", async () => {
    process.env.GROQ_API_KEY = "key";
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"kind":"SpendByDay"}' } }] });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ text: "hi" }) }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan.kind).toBe("SpendByDay");
  });

  it("handles invalid JSON", async () => {
    process.env.GROQ_API_KEY = "key";
    mockCreate.mockResolvedValue({ choices: [{ message: { content: "not-json" } }] });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ text: "hi" }) }));
    expect(res.status).toBe(400);
  });

  it("requires API key", async () => {
    delete process.env.GROQ_API_KEY;
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ text: "hi" }) }));
    expect(res.status).toBe(501);
  });
});
