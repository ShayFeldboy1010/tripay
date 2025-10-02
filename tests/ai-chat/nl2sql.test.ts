import { describe, expect, it } from "vitest";
import { __test__parsePlan } from "@/services/ai-expenses/nl2sql";

describe("nl2sql parsing", () => {
  it("parses valid planner output", () => {
    const raw = JSON.stringify({
      intent: "aggregation",
      since: "2024-01-01",
      until: "2024-01-31",
      dimensions: ["category"],
      metrics: ["sum"],
      filters: [{ column: "category", op: "=", value: "Groceries" }],
      sql: "SELECT category, SUM(amount) AS total FROM ai_expenses WHERE category = 'Groceries' LIMIT 200",
    });

    const plan = __test__parsePlan(raw);
    expect(plan.intent).toBe("aggregation");
    expect(plan.dimensions).toEqual(["category"]);
    expect(plan.metrics).toEqual(["sum"]);
    expect(plan.filters[0]?.column).toBe("category");
  });

  it("defaults missing arrays", () => {
    const raw = JSON.stringify({
      intent: "lookup",
      since: "2024-01-01",
      until: "2024-02-01",
      sql: "SELECT date, amount FROM ai_expenses LIMIT 10",
    });
    const plan = __test__parsePlan(raw);
    expect(plan.filters).toEqual([]);
    expect(plan.dimensions).toEqual([]);
    expect(plan.metrics).toEqual([]);
  });

  it("rejects malformed JSON", () => {
    expect(() => __test__parsePlan("not json")).toThrowError(/Failed to parse/);
  });
});

