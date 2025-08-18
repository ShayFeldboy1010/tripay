import { UtensilsCrossed, Car, BedDouble, Moon, Tag } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Expense } from "@/lib/supabase/client"

export const categoryIcons: Record<Expense["category"], LucideIcon> = {
  Food: UtensilsCrossed,
  Transportation: Car,
  Accommodation: BedDouble,
  Sleep: Moon,
  Other: Tag
}
