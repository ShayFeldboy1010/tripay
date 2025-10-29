import { beforeEach, describe, expect, it, vi } from "vitest";
import { executePlan } from "@/services/ai-expenses/sqlExecutor";

const getClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/src/server/supabase/client", () => ({
  getServerSupabaseClient: () => getClientMock(),
}));

function createBuilder(result: { data: any[] | null; error: any }) {
  const operations = {
    select: [] as string[],
    eq: [] as Array<{ column: string; value: any }>,
    gte: [] as Array<{ column: string; value: any }>,
    lte: [] as Array<{ column: string; value: any }>,
    order: [] as Array<{ column: string; options: any }>,
    limit: [] as number[],
  };
  const builder: any = {
    select: vi.fn((columns: string) => {
      operations.select.push(columns);
      return builder;
    }),
    eq: vi.fn((column: string, value: any) => {
      operations.eq.push({ column, value });
      return builder;
    }),
    gte: vi.fn((column: string, value: any) => {
      operations.gte.push({ column, value });
      return builder;
    }),
    lte: vi.fn((column: string, value: any) => {
      operations.lte.push({ column, value });
      return builder;
    }),
    order: vi.fn((column: string, options: any) => {
      operations.order.push({ column, options });
      return builder;
    }),
    limit: vi.fn((value: number) => {
      operations.limit.push(value);
      return builder;
    }),
    then: (onFulfilled: any, onRejected?: any) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: any) => Promise.resolve(result).catch(onRejected),
    finally: (onFinally: any) => Promise.resolve(result).finally(onFinally),
  };
  return { builder, operations };
}

const basePlan = {
  intent: "aggregation" as const,
  dimensions: [],
  metrics: ["sum"],
  filters: [{ column: "category", op: "=", value: "Food" }],
  since: "2025-01-01",
  until: "2025-01-31",
  order: [],
  limit: 120,
  sql: "SELECT date, amount, currency, category FROM ai_expenses WHERE category = 'Food' LIMIT 120",
};

describe("sqlExecutor", () => {
  beforeEach(() => {
    getClientMock.mockReset();
  });

  it("injects user and date filters and computes aggregates", async () => {
    const { builder, operations } = createBuilder({
      data: [
        { date: "2025-01-05", amount: 12.5, currency: "USD", category: "Food", merchant: "Cafe", notes: null },
        { date: "2025-01-06", amount: 7.5, currency: "USD", category: "Food", merchant: "Cafe", notes: null },
      ],
      error: null,
    });
    const supabase = { from: vi.fn(() => builder) };
    getClientMock.mockReturnValue(supabase);

    const result = await executePlan(basePlan, {
      scope: { column: "user_id", id: "user-1" },
      since: "2025-01-01",
      until: "2025-01-31",
    });

    expect(supabase.from).toHaveBeenCalledWith("ai_expenses");
    expect(operations.select[0]).toContain("date, amount, currency, category, merchant, notes");
    expect(operations.eq).toContainEqual({ column: "user_id", value: "user-1" });
    expect(operations.gte).toContainEqual({ column: "date", value: "2025-01-01" });
    expect(operations.lte).toContainEqual({ column: "date", value: "2025-01-31" });
    expect(operations.limit[0]).toBe(120);

    expect(result.rows).toHaveLength(2);
    expect(result.aggregates.total).toBeCloseTo(20);
    expect(result.aggregates.byMerchant[0].merchant).toBe("Cafe");
    expect(result.aggregates.currencyNote).toBeNull();
  });

  it("rejects unsafe SQL", async () => {
    const plan = {
      ...basePlan,
      sql: "SELECT * FROM ai_expenses",
    };

    await expect(
      executePlan(plan, {
        scope: { column: "user_id", id: "user-1" },
        since: "2025-01-01",
        until: "2025-01-31",
      }),
    ).rejects.toThrow(/Wildcard/);
    expect(getClientMock).not.toHaveBeenCalled();
  });

  it("blocks DML statements", async () => {
    const plan = {
      ...basePlan,
      sql: "DELETE FROM ai_expenses WHERE id = '1'",
    };

    await expect(
      executePlan(plan, {
        scope: { column: "user_id", id: "user-1" },
        since: "2025-01-01",
        until: "2025-01-31",
      }),
    ).rejects.toThrow(/Only SELECT/);
  });

  it("blocks subqueries", async () => {
    const plan = {
      ...basePlan,
      sql: "SELECT date FROM ai_expenses WHERE amount > (SELECT AVG(amount) FROM ai_expenses)",
    };

    await expect(
      executePlan(plan, {
        scope: { column: "user_id", id: "user-1" },
        since: "2025-01-01",
        until: "2025-01-31",
      }),
    ).rejects.toThrow(/Subqueries/);
  });
});
