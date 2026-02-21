import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables")
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Lazy singleton - only created when actually used at runtime
let _client: ReturnType<typeof createBrowserClient> | null = null

export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    if (!_client) {
      _client = getSupabaseClient()
    }
    return (_client as any)[prop]
  },
})

export type Trip = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  total_budget?: number | null
  start_date?: string | null
  end_date?: string | null
  base_currency?: string | null
  created_by?: string | null
}

export type Expense = {
  id: string
  trip_id: string
  title: string
  amount: number
  category: "Food" | "Transportation" | "Accommodation" | "Sleep" | "Other"
  location_id: string
  payers: string[]
  date: string
  note?: string | null
  description?: string | null
  paid_by?: string
  location?: string
  is_shared_payment?: boolean
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

export type TripMember = {
  id: string
  trip_id: string
  user_id: string
  role: "owner" | "member"
  joined_at: string
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
