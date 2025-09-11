import { describe, it, expect } from "vitest";
import { executeAIQuery } from "@/lib/ai/execute";
import type { Expense, Trip } from "@/lib/supabase/client";
import type { AIQuery } from "@/lib/ai/schema";

describe("executeAIQuery", () => {
  const base: Omit<Expense, "id" | "created_at" | "updated_at"> = {
    trip_id: "t1",
    title: "",
    amount: 0,
    category: "Food",
    location_id: "l1",
    payers: [],
    date: "2024-05-01",
    is_shared_payment: false,
  };

  const expenses: Expense[] = [
    { id: "1", ...base, amount: 100, category: "Food" },
    { id: "2", ...base, amount: 50, category: "Transportation", date: "2024-05-02" },
    { id: "3", ...base, amount: 80, category: "Accommodation", date: "2024-05-02" },
    { id: "4", ...base, amount: 40, category: "Food", date: "2024-05-03" },
    { id: "5", ...base, amount: 70, category: "Sleep", date: "2024-05-03" },
  ].map((e) => ({ ...e, created_at: "", updated_at: "" }));

  const trip: Trip = {
    id: "t1",
    name: "Trip",
    description: null,
    created_at: "",
    updated_at: "",
    total_budget: 500,
    base_currency: "USD",
  };

  it("compares categories", () => {
    const q: AIQuery = { kind: "CompareCategories", categories: ["Accommodation", "Food"] };
    const ans = executeAIQuery(q, { expenses, trip });
    expect(ans.facts).toEqual([
      { label: "Accommodation", value: "$150.00" },
      { label: "Food", value: "$140.00" },
    ]);
  });

  it("totals by category", () => {
    const q: AIQuery = { kind: "TotalByCategory", category: "Food" };
    const ans = executeAIQuery(q, { expenses, trip });
    expect(ans.facts[0]).toEqual({ label: "Food", value: "$140.00" });
  });

  it("spend by day", () => {
    const q: AIQuery = { kind: "SpendByDay" };
    const ans = executeAIQuery(q, { expenses, trip });
    expect(ans.facts.length).toBe(3);
  });

  it("budget status", () => {
    const q: AIQuery = { kind: "BudgetStatus" };
    const ans = executeAIQuery(q, { expenses, trip });
    expect(ans.facts.some((f) => f.label === "Remaining")).toBe(true);
  });

  it("budget status without config", () => {
    const q: AIQuery = { kind: "BudgetStatus" };
    const ans = executeAIQuery(q, { expenses, trip: { ...trip, total_budget: undefined } });
    expect(ans.text).toBe("No budget configured");
  });
});
