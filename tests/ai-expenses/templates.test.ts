import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runHighestExpenseFallback,
  runTopMerchantsFallback,
  runTotalsByCategoryFallback,
  runTotalsFallback,
} from "@/services/ai-expenses/templates";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@/src/server/db/pool", () => ({
  query: queryMock,
}));

describe("templates", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns the highest expense row", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { date: "2025-02-02", amount: 99, currency: "USD", category: "Flights", merchant: "Airline", notes: null },
      ],
    });

    const result = await runHighestExpenseFallback({
      scope: { column: "user_id", id: "u" },
      since: "2025-02-01",
      until: "2025-02-28",
    });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY amount DESC"), [
      "u",
      "2025-02-01",
      "2025-02-28",
    ]);
    expect(result.rows[0].amount).toBe(99);
    expect(result.aggregates.max?.amount).toBe(99);
    expect(result.rows[0].date).toBe("2025-02-02");
  });

  it("builds totals fallback", async () => {
    queryMock.mockResolvedValue({
      rows: [],
    });
    await runTotalsFallback({
      scope: { column: "user_id", id: "u" },
      since: "2025-01-01",
      until: "2025-01-31",
    });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY date DESC"), [
      "u",
      "2025-01-01",
      "2025-01-31",
    ]);
  });

  it("creates synthetic rows for category totals", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { category: "Food", currency: "USD", sum: 120 },
        { category: "Travel", currency: "EUR", sum: 90 },
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
    queryMock.mockResolvedValue({
      rows: [
        { merchant: "Cafe", currency: "USD", sum: 33 },
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

