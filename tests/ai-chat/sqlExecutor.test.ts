import { describe, expect, it, vi, beforeEach } from "vitest";

const getClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/src/server/supabase/client", () => ({
  getServerSupabaseClient: () => getClientMock(),
}));

import { executePlan, computeAggregatesForRows, __test__ensureSafePlan } from "@/services/ai-expenses/sqlExecutor";

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

describe("sql executor", () => {
  beforeEach(() => {
    getClientMock.mockReset();
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

    const { builder, operations } = createBuilder({
      data: [
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
      error: null,
    });
    const supabase = { from: vi.fn(() => builder) };
    getClientMock.mockReturnValue(supabase);

    const result = await executePlan(plan, {
      scope: { column: "user_id", id: "user-1234" },
      since: "2024-01-01",
      until: "2024-01-31",
    });

    expect(supabase.from).toHaveBeenCalledWith("ai_expenses");
    expect(operations.eq).toContainEqual({ column: "user_id", value: "user-1234" });
    expect(operations.gte).toContainEqual({ column: "date", value: "2024-01-01" });
    expect(operations.lte).toContainEqual({ column: "date", value: "2024-01-31" });
    expect(operations.limit[0]).toBe(20);

    const debug = JSON.parse(result.sql);
    expect(debug.scope).toEqual({ column: "user_id", id: "user-1234" });
    expect(debug.order).toEqual({ column: "date", ascending: false });
    expect(debug.limit).toBe(20);
    expect(result.params).toEqual([]);
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

