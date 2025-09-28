import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SqlPlan } from "@/services/ai-expenses/nl2sql";
import type { ExecutionResult } from "@/services/ai-expenses/sqlExecutor";

const generateSqlPlanMock = vi.fn<[], Promise<SqlPlan>>();
const executePlanMock = vi.fn<[], Promise<ExecutionResult>>();
const runTotalsFallbackMock = vi.fn();
const runHighestExpenseFallbackMock = vi.fn();
const runTotalsByCategoryFallbackMock = vi.fn();
const runTopMerchantsFallbackMock = vi.fn();

const fakeClient = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

vi.mock("@/services/ai-expenses/nl2sql", () => ({
  generateSqlPlan: generateSqlPlanMock,
}));

vi.mock("@/services/ai-expenses/sqlExecutor", () => ({
  executePlan: executePlanMock,
}));

vi.mock("@/services/ai-expenses/templates", () => ({
  runTotalsFallback: runTotalsFallbackMock,
  runHighestExpenseFallback: runHighestExpenseFallbackMock,
  runTotalsByCategoryFallback: runTotalsByCategoryFallbackMock,
  runTopMerchantsFallback: runTopMerchantsFallbackMock,
}));

vi.mock("@/services/ai-expenses/groq", () => ({
  getGroqClient: () => fakeClient,
  getGroqModels: () => ({ primary: "primary-model", fallback: "fallback-model" }),
}));

const TEST_SCOPE_ID = "11111111-1111-1111-1111-111111111111";
const verifySseTokenMock = vi.fn(async () => ({ subject: TEST_SCOPE_ID, userId: TEST_SCOPE_ID }));

vi.mock("@/src/server/auth/jwt", () => ({
  verifySseToken: verifySseTokenMock,
}));

describe("/api/ai/expenses/chat/stream", () => {
  beforeEach(() => {
    generateSqlPlanMock.mockReset();
    executePlanMock.mockReset();
    runTotalsFallbackMock.mockReset();
    runHighestExpenseFallbackMock.mockReset();
    runTotalsByCategoryFallbackMock.mockReset();
    runTopMerchantsFallbackMock.mockReset();
    fakeClient.chat.completions.create.mockReset();
    verifySseTokenMock.mockClear();
  });

  it("streams tokens then result", async () => {
    const plan: SqlPlan = {
      intent: "aggregation",
      dimensions: [],
      metrics: ["sum"],
      filters: [],
      since: "2025-01-01",
      until: "2025-01-31",
      order: [],
      limit: 10,
      sql: "SELECT date, amount FROM expenses LIMIT 10",
    };

    const execution: ExecutionResult = {
      sql: "SELECT date, amount FROM expenses WHERE user_id = $1",
      params: [TEST_SCOPE_ID, "2025-01-01", "2025-01-31"],
      rows: [
        { date: "2025-01-05", amount: 42, currency: "USD", category: "Food", merchant: "Cafe", notes: null },
      ],
      aggregates: {
        total: 42,
        avg: 42,
        max: { amount: 42, merchant: "Cafe", date: "2025-01-05", currency: "USD" },
        byCategory: [{ category: "Food", sum: 42, currency: "USD" }],
        byMerchant: [{ merchant: "Cafe", sum: 42, currency: "USD" }],
        totalsByCurrency: [{ currency: "USD", total: 42, avg: 42, count: 1 }],
        currencyNote: null,
      },
      limit: 10,
    };

    generateSqlPlanMock.mockResolvedValue(plan);
    executePlanMock.mockResolvedValue(execution);
    fakeClient.chat.completions.create.mockImplementation(() =>
      (async function* () {
        yield { choices: [{ delta: { content: "Hello" } }] };
        yield { choices: [{ delta: { content: "!" } }] };
      })(),
    );

    const { GET } = await import("@/app/api/ai/expenses/chat/stream/route");
    const req = new Request(
      "http://localhost/api/ai/expenses/chat/stream?q=total&since=2025-01-01&until=2025-01-31&tz=UTC&token=test-token",
    );

    const res = await GET(req as any);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
    }

    const events = raw
      .split("\n\n")
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const metaEvent = events.find((entry) => entry.startsWith("event: meta"));
    const tokenEvent = events.find((entry) => entry.startsWith("event: token"));
    const resultEvent = events.find((entry) => entry.startsWith("event: result"));

    expect(metaEvent).toBeDefined();
    expect(tokenEvent).toBeDefined();
    expect(resultEvent).toBeDefined();

    const payloadLine = resultEvent!.split("\n").find((line) => line.startsWith("data:"));
    expect(payloadLine).toBeDefined();
    const payload = JSON.parse(payloadLine!.slice(5).trim());
    expect(payload.answer).toBe("Hello!");
    expect(payload.sql).toContain("SELECT date, amount");
    expect(payload.timeRange.since).toBe("2025-01-01");
    expect(payload.rows[0].merchant).toBe("Cafe");
    expect(payload.fallbackReason).toBeNull();

    expect(generateSqlPlanMock).toHaveBeenCalledWith("total", expect.objectContaining({ since: "2025-01-01" }));
    expect(executePlanMock).toHaveBeenCalled();
    expect(verifySseTokenMock).toHaveBeenCalledWith("test-token");
  });
});

