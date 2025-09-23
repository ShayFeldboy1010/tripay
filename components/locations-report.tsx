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
      <h2 className="truncate-1 text-balance text-xl font-semibold text-white">Spending by Location</h2>

      {locationData.map(({ location, total, categories }) => (
        <Card key={location}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="shrink-min">
                <CardTitle dir="auto" className="truncate-1 text-balance text-lg text-white">
                  {location}
                </CardTitle>
              </div>
              <div className="flex-none text-right">
                <span className="grad-text text-xl font-bold">₪{total.toFixed(2)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <h4 className="mb-2 text-sm font-medium text-white/70">Category Breakdown:</h4>
              {categories.map(({ category, amount, expenses: categoryExpenses }) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-3 border-b border-white/10 py-2">
                    <div className="flex items-center gap-2 shrink-min">
                      <span
                        className="h-2.5 w-2.5 flex-none rounded-full"
                        style={{ backgroundColor: colorForKey(category) }}
                      />
                      <div className="shrink-min">
                        <p dir="auto" className="truncate-1 text-balance text-sm font-semibold text-white">
                          {category}
                        </p>
                        <p className="truncate-2 text-xs text-white/70 leading-tight">
                          {categoryExpenses.length} expenses
                        </p>
                      </div>
                    </div>
                    <div className="flex-none text-right">
                      <p className="text-sm font-medium text-white">₪{amount.toFixed(2)}</p>
                      <p className="truncate-2 text-xs text-white/60 leading-tight">
                        ({((amount / total) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  <div className="ms-4 space-y-1">
                    {categoryExpenses.map((expense) => (
                      <div key={expense.id} className="flex items-center gap-3 py-1 text-xs">
                        <div className="shrink-min">
                          <p dir="auto" className="truncate-1 text-balance text-white/80">
                            {expense.title || "Untitled"}
                          </p>
                          {expense.description && (
                            <p dir="auto" className="truncate-2 text-[11px] text-white/60 leading-tight">
                              {expense.description}
                            </p>
                          )}
                        </div>
                        <div className="flex-none text-right">
                          <span className="font-medium text-white">₪{expense.amount.toFixed(2)}</span>
                        </div>
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
