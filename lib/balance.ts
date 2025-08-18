import type { Expense } from "@/lib/supabase/client"

export interface Balance {
  from: string
  to: string
  amount: number
}

export function calculateBalances(expenses: Expense[]): Balance[] {
  const participants = Array.from(
    new Set(expenses.map((e) => e.paid_by).filter((p) => p !== "Both" && p !== "Multiple")),
  )
  const balances: Record<string, Record<string, number>> = {}

  participants.forEach((p1) => {
    balances[p1] = {}
    participants.forEach((p2) => {
      if (p1 !== p2) balances[p1][p2] = 0
    })
  })

  expenses.forEach((expense) => {
    if (expense.paid_by === "Both" || expense.paid_by === "Multiple" || expense.is_shared_payment) return

    const payer = expense.paid_by
    const amountPerPerson = expense.amount / participants.length

    participants.forEach((participant) => {
      if (participant !== payer) {
        balances[participant][payer] += amountPerPerson
      }
    })
  })

  const netBalances: Balance[] = []

  participants.forEach((p1) => {
    participants.forEach((p2) => {
      if (p1 !== p2) {
        const debt1to2 = balances[p1][p2] || 0
        const debt2to1 = balances[p2][p1] || 0
        const netDebt = debt1to2 - debt2to1
        if (netDebt > 0.01) {
          netBalances.push({ from: p1, to: p2, amount: netDebt })
          balances[p2][p1] = 0
        }
      }
    })
  })

  return netBalances.sort((a, b) => b.amount - a.amount)
}
