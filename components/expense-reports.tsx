"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Expense } from "@/lib/supabase/client"
import { calculateBalances } from "@/lib/balance"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Users, Banknote, Calendar } from "lucide-react"
import { LocationsReport } from "@/components/locations-report"
import { colorForKey } from "@/lib/chartColors"

const tabs = ["Overview", "People", "Categories", "Locations", "Timeline"] as const
type TabValue = (typeof tabs)[number]

function getTabSlug(tab: TabValue) {
  return tab
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function getTabId(prefix: string, tab: TabValue) {
  return `${prefix}-tab-${getTabSlug(tab)}`
}

function getPanelId(prefix: string, tab: TabValue) {
  return `${prefix}-panel-${getTabSlug(tab)}`
}

interface SummaryTabsProps {
  value: TabValue
  onChange: (value: TabValue) => void
  idPrefix: string
}

function SummaryTabs({ value, onChange, idPrefix }: SummaryTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const focusTab = (index: number) => {
    const tab = tabs[index]
    if (!tab) return
    onChange(tab)
    tabRefs.current[index]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown": {
        event.preventDefault()
        focusTab((index + 1) % tabs.length)
        break
      }
      case "ArrowLeft":
      case "ArrowUp": {
        event.preventDefault()
        focusTab((index - 1 + tabs.length) % tabs.length)
        break
      }
      case "Home": {
        event.preventDefault()
        focusTab(0)
        break
      }
      case "End": {
        event.preventDefault()
        focusTab(tabs.length - 1)
        break
      }
      default:
        break
    }
  }

  return (
    <div className="glass rounded-[20px] px-2 py-2">
      <div
        className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory"
        role="tablist"
        aria-orientation="horizontal"
      >
        {tabs.map((t, index) => {
          const active = value === t
          const tabId = getTabId(idPrefix, t)
          const panelId = getPanelId(idPrefix, t)
          return (
            <button
              key={t}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={tabId}
              onClick={() => onChange(t)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              className={[
                "snap-start shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition",
                active
                  ? "glass-sm text-white shadow"
                  : "bg-transparent text-white/80 hover:text-white hover:bg-white/5",
              ].join(" ")}
            >
              <span className="truncate-1">{t}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface ExpenseReportsProps {
  expenses: Expense[]
  className?: string
}

export function ExpenseReports({ expenses, className }: ExpenseReportsProps) {
  const [selectedTab, setSelectedTab] = useState<TabValue>("Overview")
  const tabsIdPrefix = useId()

  // Calculate summary statistics
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const averageExpense = expenses.length > 0 ? totalAmount / expenses.length : 0
  const uniquePayers = new Set(expenses.map((e) => e.paid_by)).size
  const uniqueCategories = new Set(expenses.map((e) => e.category).filter(Boolean)).size

  // Group expenses by payer
  const expensesByPayer = expenses.reduce(
    (acc, expense) => {
      if (!acc[expense.paid_by]) {
        acc[expense.paid_by] = { total: 0, count: 0, expenses: [] }
      }
      acc[expense.paid_by].total += expense.amount
      acc[expense.paid_by].count += 1
      acc[expense.paid_by].expenses.push(expense)
      return acc
    },
    {} as Record<string, { total: number; count: number; expenses: Expense[] }>,
  )

  const balances = calculateBalances(expenses)

  // Group expenses by category
  const expensesByCategory = expenses.reduce(
    (acc, expense) => {
      const category = expense.category || "Uncategorized"
      if (!acc[category]) {
        acc[category] = { total: 0, count: 0, expenses: [] }
      }
      acc[category].total += expense.amount
      acc[category].count += 1
      acc[category].expenses.push(expense)
      return acc
    },
    {} as Record<string, { total: number; count: number; expenses: Expense[] }>,
  )

  // Prepare chart data
  const payerChartData = Object.entries(expensesByPayer).map(([payer, data]) => ({
    name: payer,
    amount: data.total,
    count: data.count,
  }))

  const categoryChartData = Object.entries(expensesByCategory).map(([category, data]) => ({
    name: category,
    amount: data.total,
    count: data.count,
  }))

  // Deterministic colors handled by colorForKey

  // Group expenses by date for timeline
  const expensesByDate = expenses.reduce(
    (acc, expense) => {
      const date = new Date(expense.created_at).toDateString()
      if (!acc[date]) {
        acc[date] = { total: 0, count: 0 }
      }
      acc[date].total += expense.amount
      acc[date].count += 1
      return acc
    },
    {} as Record<string, { total: number; count: number }>,
  )

  const timelineData = Object.entries(expensesByDate)
    .map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: data.total,
      count: data.count,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (expenses.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <p className="text-white/60">No expenses to analyze</p>
          <p className="mt-1 text-sm text-white/50">Add some expenses to see reports</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        <SummaryTabs idPrefix={tabsIdPrefix} value={selectedTab} onChange={setSelectedTab} />

        {selectedTab === "Overview" && (
          <div
            role="tabpanel"
            id={getPanelId(tabsIdPrefix, "Overview")}
            aria-labelledby={getTabId(tabsIdPrefix, "Overview")}
            tabIndex={0}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold numeric-display">₪{totalAmount.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">{expenses.length} expenses</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold numeric-display">₪{averageExpense.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">per expense</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contributors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold numeric-display">{uniquePayers}</div>
                  <p className="text-xs text-muted-foreground">people</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Categories</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold numeric-display">{uniqueCategories}</div>
                  <p className="text-xs text-muted-foreground">different types</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top Categories</CardTitle>
                <CardDescription>Highest spending by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(expensesByCategory)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .slice(0, 5)
                    .map(([category, data]) => (
                      <div key={category} className="flex items-center gap-3">
                        <div className="flex items-center gap-3 shrink-min">
                          <Badge
                            variant="outline"
                            dir="auto"
                            className="shrink-0 text-white"
                            style={{ backgroundColor: colorForKey(category), borderColor: colorForKey(category) }}
                          >
                            {category}
                          </Badge>
                          <div className="shrink-min">
                            <p dir="auto" className="truncate-1 text-balance text-sm font-semibold text-white">
                              {category}
                            </p>
                            <p className="truncate-2 text-xs text-white/70 leading-tight">{data.count} expenses</p>
                          </div>
                        </div>
                        <div className="flex-none text-right">
                          <span className="grad-text numeric-display text-sm font-semibold">₪{data.total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "People" && (
          <div
            role="tabpanel"
            id={getPanelId(tabsIdPrefix, "People")}
            aria-labelledby={getTabId(tabsIdPrefix, "People")}
            tabIndex={0}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>Spending by Person</CardTitle>
                <CardDescription>How much each person has paid</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payerChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`₪${Number(value).toFixed(2)}`, "Amount"]} />
                      <Bar dataKey="amount">
                        {payerChartData.map((entry) => (
                          <Cell key={entry.name} fill={colorForKey(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Balance Summary</CardTitle>
                <CardDescription>Who owes whom (shared expenses excluded)</CardDescription>
              </CardHeader>
              <CardContent>
                {balances.length === 0 ? (
                  <p className="py-4 text-center text-white/60">All balanced! No outstanding debts.</p>
                ) : (
                  <div className="space-y-3">
                    {balances.map((balance, index) => (
                      <div key={index} className="glass-sm flex items-center gap-3 rounded-2xl p-3">
                        <div className="shrink-min">
                          <p dir="auto" className="truncate-1 text-balance text-sm font-semibold text-white">
                            {balance.from} owes {balance.to}
                          </p>
                          <p className="truncate-2 text-xs text-white/70 leading-tight">Settlement balance</p>
                        </div>
                        <div className="flex-none text-right">
                          <p className="grad-text numeric-display text-lg font-bold">₪{balance.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(expensesByPayer)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([payer, data]) => (
                      <div key={payer} className="glass-sm rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-3 shrink-min">
                            <div
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: colorForKey(payer) }}
                            />
                            <div className="shrink-min">
                              <h4 dir="auto" className="truncate-1 text-balance font-semibold text-white">
                                {payer}
                              </h4>
                              <p className="truncate-2 text-sm text-white/70 leading-tight">{data.count} expenses</p>
                            </div>
                          </div>
                          <div className="flex-none text-right">
                            <p className="grad-text numeric-display text-lg font-bold">₪{data.total.toFixed(2)}</p>
                            <p className="truncate-2 text-sm text-white/70 leading-tight">
                              Avg ₪{(data.total / data.count).toFixed(2)} per expense
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "Categories" && (
          <div
            role="tabpanel"
            id={getPanelId(tabsIdPrefix, "Categories")}
            aria-labelledby={getTabId(tabsIdPrefix, "Categories")}
            tabIndex={0}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
                <CardDescription>Spending breakdown by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="amount"
                      >
                        {categoryChartData.map((entry) => (
                          <Cell key={entry.name} fill={colorForKey(entry.name)} strokeWidth={1} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`₪${Number(value).toFixed(2)}`, "Amount"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(expensesByCategory)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([category, data]) => (
                      <div key={category} className="glass-sm flex items-center gap-3 rounded-2xl p-3">
                        <div className="flex items-center gap-3 shrink-min">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: colorForKey(category) }}
                          />
                          <div className="shrink-min">
                            <p dir="auto" className="truncate-1 text-balance font-medium text-white">
                              {category}
                            </p>
                            <p className="truncate-2 text-sm text-white/70 leading-tight">{data.count} expenses</p>
                          </div>
                        </div>
                        <div className="flex-none text-right">
                          <p className="grad-text numeric-display font-semibold">₪{data.total.toFixed(2)}</p>
                          <p className="truncate-2 text-sm text-white/70 leading-tight">
                            {((data.total / totalAmount) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "Locations" && (
          <div
            role="tabpanel"
            id={getPanelId(tabsIdPrefix, "Locations")}
            aria-labelledby={getTabId(tabsIdPrefix, "Locations")}
            tabIndex={0}
            className="space-y-4"
          >
            <LocationsReport expenses={expenses} />
          </div>
        )}

        {selectedTab === "Timeline" && (
          <div
            role="tabpanel"
            id={getPanelId(tabsIdPrefix, "Timeline")}
            aria-labelledby={getTabId(tabsIdPrefix, "Timeline")}
            tabIndex={0}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>Spending Timeline</CardTitle>
                <CardDescription>Daily spending pattern</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={timelineData}
                      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                      style={{ background: "transparent" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
                        tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
                        tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
                        width={60}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.08)" }}
                        contentStyle={{
                          background: "rgba(15,23,42,0.88)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 12,
                          color: "#fff",
                        }}
                        labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                        formatter={(value, name) => [
                          name === "amount" ? `₪${Number(value).toFixed(2)}` : value,
                          name === "amount" ? "Amount" : "Count",
                        ]}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(expensesByDate)
                    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                    .map(([date, data]) => (
                      <div key={date} className="glass-sm flex items-center gap-3 rounded-2xl p-3">
                        <div className="shrink-min">
                          <p className="truncate-1 text-balance font-medium text-white">
                            {new Date(date).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p className="truncate-2 text-sm text-white/70 leading-tight">{data.count} expenses</p>
                        </div>
                        <div className="flex-none text-right">
                          <p className="grad-text numeric-display font-semibold">₪{data.total.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
