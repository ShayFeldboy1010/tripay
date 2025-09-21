import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const supabaseFromMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

const answerQuestionMock = vi.fn();
vi.mock("@/services/nlq/answerQuestion", () => ({
  answerQuestion: answerQuestionMock,
}));

const createLLMMock = vi.fn();
vi.mock("@/src/server/llm/provider", async () => {
  const actual = await vi.importActual<typeof import("@/src/server/llm/provider")>(
    "@/src/server/llm/provider"
  );
  return {
    ...actual,
    createLLM: createLLMMock,
  };
});

const tripData = { id: "trip1", base_currency: "USD" };
const expensesData = [
  {
    id: "exp1",
    trip_id: "trip1",
    title: "Dinner",
    amount: 42,
    category: "Food" as const,
    location_id: "loc1",
    payers: [],
    date: "2024-01-01",
    is_shared_payment: false,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
];

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

describe("ai chat API", () => {
  beforeEach(() => {
    vi.resetModules();
    answerQuestionMock.mockReset();
    createLLMMock.mockClear();
    supabaseFromMock.mockReset();
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "trips") {
        const builder: any = {
          select: vi.fn(),
          eq: vi.fn(),
          single: vi.fn(),
        };
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.single.mockResolvedValue({ data: tripData });
        return builder;
      }
      if (table === "expenses") {
        const builder: any = {
          select: vi.fn(),
          eq: vi.fn(),
        };
        builder.select.mockReturnValue(builder);
        builder.eq.mockResolvedValue({ data: expensesData });
        return builder;
      }
      throw new Error(`Unexpected table ${table}`);
    });
    for (const key of ENV_VARS) {
      delete process.env[key];
    }
    answerQuestionMock.mockResolvedValue({ text: "answer", details: {}, warnings: [] });
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

  it("returns Groq-backed answers using Supabase data", async () => {
    process.env.GROQ_API_KEY = "key";

    const { POST } = await import("@/app/api/ai/chat/route");
    const req = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        question: "How much did I spend?",
        tripId: "trip1",
        locale: "he",
        timezone: "Asia/Jerusalem",
      }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(answerQuestionMock).toHaveBeenCalledWith("How much did I spend?", {
      baseCurrency: "USD",
      expenses: expensesData,
    });
    expect(json.provider).toBe("groq");
    expect(json.modelUsed).toBe("llama-3.1-8b-instant");
    expect(json.answer).toBe("answer");
    expect(createLLMMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "groq", model: "llama-3.1-8b-instant" })
    );
  });
});
