import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runHighestExpenseFallback,
  runTopMerchantsFallback,
  runTotalsByCategoryFallback,
  runTotalsFallback,
} from "@/services/ai-expenses/templates";

const fetchExpenseRowsMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/ai-expenses/sqlExecutor", async () => {
  const actual = await vi.importActual<typeof import("@/services/ai-expenses/sqlExecutor")>(
    "@/services/ai-expenses/sqlExecutor",
  );
  return {
    ...actual,
    fetchExpenseRows: fetchExpenseRowsMock,
  };
});

describe("templates", () => {
  beforeEach(() => {
    fetchExpenseRowsMock.mockReset();
  });

  it("returns the highest expense row", async () => {
    fetchExpenseRowsMock.mockResolvedValue({
      sql: JSON.stringify({ limit: 1 }),
      rows: [
        { date: "2025-02-02", amount: 99, currency: "USD", category: "Flights", merchant: "Airline", notes: null },
      ],
    });

    const result = await runHighestExpenseFallback({
      scope: { column: "user_id", id: "u" },
      since: "2025-02-01",
      until: "2025-02-28",
    });
    expect(fetchExpenseRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { column: "user_id", id: "u" },
        since: "2025-02-01",
        until: "2025-02-28",
      }),
      expect.objectContaining({ order: { column: "amount", ascending: false }, limit: 1 }),
    );
    expect(result.rows[0].amount).toBe(99);
    expect(result.aggregates.max?.amount).toBe(99);
    expect(result.rows[0].date).toBe("2025-02-02");
  });

  it("builds totals fallback", async () => {
    fetchExpenseRowsMock.mockResolvedValue({
      sql: JSON.stringify({ limit: 200 }),
      rows: [],
    });
    await runTotalsFallback({
      scope: { column: "user_id", id: "u" },
      since: "2025-01-01",
      until: "2025-01-31",
    });
    expect(fetchExpenseRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { column: "user_id", id: "u" },
      }),
      expect.objectContaining({ order: { column: "date", ascending: false }, limit: 200 }),
    );
  });

  it("creates synthetic rows for category totals", async () => {
    fetchExpenseRowsMock.mockResolvedValue({
      sql: JSON.stringify({}),
      rows: [
        { date: "2025-02-01", amount: 120, currency: "USD", category: "Food", merchant: null, notes: null },
        { date: "2025-02-01", amount: 90, currency: "EUR", category: "Travel", merchant: null, notes: null },
      ],
    });

    const result = await runTotalsByCategoryFallback({
      scope: { column: "user_id", id: "u" },
      since: "2025-01-01",
      until: "2025-01-31",
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].category).toBe("Food");
    expect(result.rows[0].amount).toBe(120);
    expect(result.aggregates.totalsByCurrency).toHaveLength(2);
  });

  it("creates synthetic rows for merchant totals", async () => {
    fetchExpenseRowsMock.mockResolvedValue({
      sql: JSON.stringify({}),
      rows: [
        { date: "2025-02-01", amount: 33, currency: "USD", category: null, merchant: "Cafe", notes: null },
      ],
    });

    const result = await runTopMerchantsFallback({
      scope: { column: "user_id", id: "u" },
      since: "2025-01-01",
      until: "2025-01-31",
    });

    expect(result.rows[0].merchant).toBe("Cafe");
    expect(result.rows[0].amount).toBe(33);
    expect(result.aggregates.byMerchant[0].merchant).toBe("Cafe");
  });
});

