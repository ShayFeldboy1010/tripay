import { describe, it, expect, vi } from "vitest"
import { createExpense, updateExpense } from "@/lib/expenses"

vi.mock("@/lib/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
    },
  }
})

const { supabase } = await import("@/lib/supabase/client")

describe("expenses api", () => {
  it("creates an expense", async () => {
    supabase.single.mockResolvedValue({ data: { id: "1" }, error: null })
    const data = await createExpense({} as any)
    expect(data).toEqual({ id: "1" })
  })

  it("updates an expense", async () => {
    supabase.single.mockResolvedValue({ data: { id: "1", amount: 10 }, error: null })
    const data = await updateExpense("1", { amount: 10 })
    expect(data).toEqual({ id: "1", amount: 10 })
  })
})
