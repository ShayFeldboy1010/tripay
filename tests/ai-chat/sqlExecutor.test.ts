import { describe, expect, it, vi, beforeEach } from "vitest";

const queryMock = vi.hoisted(() =>
  vi.fn(async () => ({
    rows: [
      {
        date: "2024-01-10",
        amount: 120.5,
        currency: "USD",
        category: "Food",
        merchant: "Cafe",
        notes: null,
      },
      {
        date: "2024-01-11",
        amount: 80,
        currency: "EUR",
        category: "Travel",
        merchant: "Train",
        notes: null,
      },
    ],
  }))
);

vi.mock("@/src/server/db/pool", () => ({
  query: queryMock,
}));

import { executePlan, computeAggregatesForRows, __test__ensureSafePlan } from "@/services/ai-expenses/sqlExecutor";

describe("sql executor", () => {
  beforeEach(() => {
    queryMock.mockClear();
  });

  it("rejects non-select statements", () => {
    expect(() =>
      __test__ensureSafePlan({
      sql: "DELETE FROM ai_expenses WHERE id = 1",
        intent: "lookup",
        filters: [],
        dimensions: [],
        metrics: [],
        since: "2024-01-01",
        until: "2024-01-31",
        order: [],
        limit: 100,
      } as any)
    ).toThrow(/Only SELECT statements/);
  });

  it("injects user and date predicates", async () => {
    const plan = {
      intent: "lookup" as const,
      filters: [],
      dimensions: [],
      metrics: [],
      since: "2024-01-01",
      until: "2024-01-31",
      order: [],
      limit: 20,
      sql: "SELECT date, amount FROM ai_expenses ORDER BY date DESC LIMIT 20",
    };

    const result = await executePlan(plan, {
      scope: { column: "user_id", id: "user-1234" },
      since: "2024-01-01",
      until: "2024-01-31",
    });
    expect(result.sql).toContain("user_id = $1");
    expect(result.sql).toContain("date BETWEEN $2 AND $3");
    expect(result.params.slice(0, 3)).toEqual(["user-1234", "2024-01-01", "2024-01-31"]);
  });

  it("aggregates per currency", () => {
    const aggregates = computeAggregatesForRows([
      {
        date: "2024-01-10",
        amount: 120.5,
        currency: "USD",
        category: "Food",
        merchant: "Cafe",
        notes: null,
      },
      {
        date: "2024-01-11",
        amount: 80,
        currency: "EUR",
        category: "Travel",
        merchant: "Train",
        notes: null,
      },
    ]);

    const totals = new Map(aggregates.totalsByCurrency.map((row) => [row.currency, row]));
    expect(totals.get("USD")?.total).toBeCloseTo(120.5);
    expect(totals.get("EUR")?.total).toBeCloseTo(80);
  });
});

