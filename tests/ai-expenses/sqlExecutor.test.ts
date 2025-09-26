import { beforeEach, describe, expect, it, vi } from "vitest";
import { executePlan } from "@/services/ai-expenses/sqlExecutor";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@/src/server/db/pool", () => ({
  query: queryMock,
}));

const basePlan = {
  intent: "aggregation" as const,
  dimensions: [],
  metrics: ["sum"],
  filters: [{ column: "category", op: "=", value: "Food" }],
  since: "2025-01-01",
  until: "2025-01-31",
  sql: "SELECT date, amount, currency, category FROM expenses WHERE category = 'Food' LIMIT 120",
};

describe("sqlExecutor", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("injects user and date filters and computes aggregates", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { date: "2025-01-05", amount: 12.5, currency: "USD", category: "Food", merchant: "Cafe", notes: null },
        { date: "2025-01-06", amount: 7.5, currency: "USD", category: "Food", merchant: "Cafe", notes: null },
      ],
    });

    const result = await executePlan(basePlan, {
      userId: "user-1",
      since: "2025-01-01",
      until: "2025-01-31",
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("user_id = $1");
    expect(sql).toContain("date >= $2");
    expect(sql).toContain("date <= $3");
    expect(sql).toContain("category = $4");
    expect(sql).toContain("LIMIT 120");
    expect(params).toEqual(["user-1", "2025-01-01", "2025-01-31", "Food"]);

    expect(result.rows).toHaveLength(2);
    expect(result.aggregates.total).toBeCloseTo(20);
    expect(result.aggregates.byMerchant[0].merchant).toBe("Cafe");
  });

  it("rejects unsafe SQL", async () => {
    const plan = {
      ...basePlan,
      sql: "SELECT * FROM expenses",
    };

    await expect(
      executePlan(plan, {
        userId: "user-1",
        since: "2025-01-01",
        until: "2025-01-31",
      }),
    ).rejects.toThrow(/Wildcard/);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

