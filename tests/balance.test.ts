import { describe, it, expect } from "vitest"
import { calculateBalances } from "@/lib/balance"
import type { Expense } from "@/lib/supabase/client"

describe("calculateBalances", () => {
  const base: Omit<Expense, "id" | "created_at" | "updated_at"> = {
    trip_id: "t1",
    title: "",
    amount: 0,
    category: "Food",
    location_id: "l1",
    payers: [],
    date: "2024-01-01",
    location: "",
    paid_by: "A",
    description: "",
    is_shared_payment: false,
  }

  it("excludes shared payments from balance", () => {
    const expenses: Expense[] = [
      { id: "1", ...base, amount: 100, paid_by: "A", payers: ["p1"], is_shared_payment: false, created_at: "", updated_at: "" },
      { id: "2", ...base, amount: 50, paid_by: "B", payers: ["p2"], is_shared_payment: true, created_at: "", updated_at: "" },
    ]
    const result = calculateBalances(expenses)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ from: "B", to: "A", amount: 50 })
  })
})
