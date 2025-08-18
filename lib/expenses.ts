import { supabase, type Expense } from "@/lib/supabase/client"

export async function createExpense(expense: Omit<Expense, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase.from("expenses").insert([expense]).select().single()
  if (error) {
    console.error("Supabase insert error", {
      code: error.code,
      message: error.message,
      details: error.details,
    })
    throw error
  }
  return data as Expense
}

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const { data, error } = await supabase.from("expenses").update(updates).eq("id", id).select().single()
  if (error) {
    console.error("Supabase update error", {
      code: error.code,
      message: error.message,
      details: error.details,
    })
    throw error
  }
  return data as Expense
}
