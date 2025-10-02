import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateSqlPlan } from "@/services/ai-expenses/nl2sql";

const createMock = vi.fn();

vi.mock("@/services/ai-expenses/groq", () => ({
  getGroqClient: () => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  }),
  getGroqModels: () => ({ primary: "primary-model", fallback: "fallback-model" }),
}));

describe("nl2sql planner contract", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("retries once when JSON parsing fails", async () => {
    createMock
      .mockResolvedValueOnce({ choices: [{ message: { content: "not json" } }] })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: "aggregation",
                since: "2025-01-01",
                until: "2025-01-31",
                dimensions: ["category"],
                metrics: ["sum"],
                filters: [],
                order: [],
                limit: 50,
                sql: "SELECT category, currency, SUM(amount) AS sum FROM ai_expenses GROUP BY category, currency LIMIT 50",
              }),
            },
          },
        ],
      });

    const plan = await generateSqlPlan("total", {
      since: "2025-01-01",
      until: "2025-01-31",
      timezone: "UTC",
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(plan.intent).toBe("aggregation");
    expect(plan.limit).toBeLessThanOrEqual(50);
  });

  it("translates Hebrew questions before planning", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "What is my highest expense this month?",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: "ranking",
                since: "2025-01-01",
                until: "2025-01-31",
                dimensions: [],
                metrics: ["max"],
                filters: [],
                order: [],
                limit: 5,
                sql: "SELECT date, amount FROM ai_expenses ORDER BY amount DESC LIMIT 5",
              }),
            },
          },
        ],
      });

    const plan = await generateSqlPlan("מה ההוצאה הכי גבוהה החודש?", {
      since: "2025-01-01",
      until: "2025-01-31",
      timezone: "UTC",
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    const [translationCall, plannerCall] = createMock.mock.calls as any[];
    expect(translationCall[0].response_format?.type).toBe("text");
    expect(plannerCall[0].response_format?.type).toBe("json_object");
    expect(plan.intent).toBe("ranking");
    expect(plan.limit).toBeLessThanOrEqual(5);
  });
});
