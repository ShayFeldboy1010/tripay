import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Trip = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type Expense = {
  id: string
  trip_id: string
  title: string // New required field
  amount: number
  category: "Food" | "Transportation" | "Accommodation" | "Sleep" | "Other"
  location_id: string // Reference to locations table
  payers: string[] // Array of participant IDs
  date: string // ISO date string
  note?: string | null // Optional note field
  description?: string | null // Keep for backward compatibility
  paid_by?: string // Keep for backward compatibility
  location?: string // Keep for backward compatibility
  created_at: string
  updated_at: string
}

export type Location = {
  id: string
  trip_id: string
  name: string
  created_at: string
  updated_at: string
}

export type Participant = {
  id: string
  trip_id: string
  name: string
  created_at: string
  updated_at: string
}

export function formatILS(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    currencyDisplay: "symbol",
  })
    .format(amount)
    .replace("ILS", "₪")
}

export const EXPENSE_CATEGORIES = ["Food", "Transportation", "Accommodation", "Sleep", "Other"] as const
