import { supabase, type Expense } from "@/lib/supabase/client"
import { dateOnlyToUTC } from "@/lib/date"

function prepareDate(dateStr: string): string {
  return dateStr.includes("T") ? dateStr : dateOnlyToUTC(dateStr)
}

export async function createExpense(expense: Omit<Expense, "id" | "created_at" | "updated_at">) {
  const payload = { ...expense, date: prepareDate(expense.date) }
  const { data, error } = await supabase.from("expenses").insert([payload]).select().single()
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
  const payload = { ...updates }
  if (payload.date) {
    payload.date = prepareDate(payload.date)
  }
  const { data, error } = await supabase.from("expenses").update(payload).eq("id", id).select().single()
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
