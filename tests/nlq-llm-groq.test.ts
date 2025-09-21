import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const chatCompletionMock = vi.fn();
const createLLMMock = vi.fn(() => ({ chatCompletion: chatCompletionMock }));

vi.mock("@/src/server/llm/provider", async () => {
  const actual = await vi.importActual<typeof import("@/src/server/llm/provider")>(
    "@/src/server/llm/provider"
  );
  return {
    ...actual,
    createLLM: createLLMMock,
  };
});

const ENV_VARS = [
  "LLM_PROVIDER",
  "LLM_MODEL",
  "GROQ_API_KEY",
  "MOONSHOT_API_KEY",
  "GROQ_BASE_URL",
  "MOONSHOT_BASE_URL",
] as const;

const ORIGINAL_ENV: Record<(typeof ENV_VARS)[number], string | undefined> = Object.fromEntries(
  ENV_VARS.map((key) => [key, process.env[key]])
) as Record<(typeof ENV_VARS)[number], string | undefined>;

describe("textToDSL Groq integration", () => {
  beforeEach(() => {
    vi.resetModules();
    chatCompletionMock.mockReset();
    createLLMMock.mockClear();
    for (const key of ENV_VARS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_VARS) {
      const value = ORIGINAL_ENV[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("falls back to Groq defaults when only the API key is provided", async () => {
    process.env.GROQ_API_KEY = "test-key";

    const sample = {
      intent: "total_spend" as const,
      timeRange: { preset: "last7d" as const },
      filters: {},
      groupBy: null,
      currency: null,
    };
    chatCompletionMock.mockResolvedValue(JSON.stringify(sample));

    const { textToDSL } = await import("@/services/nlq/llm");
    const result = await textToDSL("כמה הוצאתי?");

    expect(createLLMMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "groq", model: "llama-3.1-8b-instant" })
    );
    expect(result).toEqual(sample);
  });
});
