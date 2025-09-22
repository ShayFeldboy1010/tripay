"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Expense } from "@/lib/supabase/client"
import { colorForKey } from "@/lib/chartColors"

interface LocationsReportProps {
  expenses: Expense[]
}

export function LocationsReport({ expenses }: LocationsReportProps) {
  const locationData = useMemo(() => {
    const locationMap = new Map<
      string,
      {
        total: number
        categories: Map<string, { amount: number; expenses: Expense[] }>
      }
    >()

    expenses.forEach((expense) => {
      const location = expense.location || "Unknown Location"
      const category = expense.category || "Other"
      const amount = Number(expense.amount)

      if (!locationMap.has(location)) {
        locationMap.set(location, { total: 0, categories: new Map() })
      }

      const locationData = locationMap.get(location)!
      locationData.total += amount

      if (!locationData.categories.has(category)) {
        locationData.categories.set(category, { amount: 0, expenses: [] })
      }

      const categoryData = locationData.categories.get(category)!
      categoryData.amount += amount
      categoryData.expenses.push(expense)
    })

    return Array.from(locationMap.entries())
      .map(([location, data]) => ({
        location,
        total: data.total,
        categories: Array.from(data.categories.entries())
          .map(([category, categoryData]) => ({
            category,
            amount: categoryData.amount,
            expenses: categoryData.expenses.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            ),
          }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.total - a.total)
  }, [expenses])

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-white/60">No expenses to analyze</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Spending by Location</h2>

      {locationData.map(({ location, total, categories }) => (
        <Card key={location}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle dir="auto" className="text-lg text-white">{location}</CardTitle>
              <span className="grad-text text-xl font-bold">₪{total.toFixed(2)}</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <h4 className="mb-2 text-sm font-medium text-white/70">Category Breakdown:</h4>
              {categories.map(({ category, amount, expenses: categoryExpenses }) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between border-b border-white/10 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        dir="auto"
                        className="text-sm px-2 py-1 rounded-full text-white"
                        style={{ backgroundColor: colorForKey(category) }}
                      >
                        {category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">₪{amount.toFixed(2)}</span>
                      <span className="text-xs text-white/60">({((amount / total) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="ms-4 space-y-1">
                    {categoryExpenses.map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between py-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span dir="auto" className="text-white/70">{expense.title || "Untitled"}</span>
                          {expense.description && <span dir="auto" className="text-white/50">• {expense.description}</span>}
                        </div>
                        <span className="font-medium text-white text-end">₪{expense.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
