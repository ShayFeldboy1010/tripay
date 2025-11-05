"use client"

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Expense } from "@/lib/supabase/client"
import { calculateBalances } from "@/lib/balance"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Users, Banknote, Calendar, FileDown, FileSpreadsheet, Loader2 } from "lucide-react"
import { LocationsReport } from "@/components/locations-report"
import { colorForKey } from "@/lib/chartColors"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { downloadExpenseSummaryPDF, downloadExpensesByDateCSV } from "@/lib/export-reports"

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
  tripName?: string
  currency?: string | null
}

export function ExpenseReports({ expenses, className, tripName, currency }: ExpenseReportsProps) {
  const [selectedTab, setSelectedTab] = useState<TabValue>("Overview")
  const tabsIdPrefix = useId()
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const resolvedCurrency = useMemo(() => {
    const normalized = currency?.trim().toUpperCase()
    if (!normalized) {
      return "ILS"
    }
    try {
      new Intl.NumberFormat("en-US", { style: "currency", currency: normalized }).format(1)
      return normalized
    } catch (error) {
      console.warn(`Unsupported currency '${currency}', defaulting to ILS.`, error)
      return "ILS"
    }
  }, [currency])

  const formatCurrency = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: resolvedCurrency })
    return (value: number) => formatter.format(value)
  }, [resolvedCurrency])

  const safeTripName = tripName?.trim() || "Trip"

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true)
      await downloadExpenseSummaryPDF(expenses, { tripName: safeTripName, currency: resolvedCurrency })
      toast.success("PDF report downloaded")
    } catch (error) {
      console.error(error)
      toast.error("Failed to export PDF report")
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true)
      await new Promise((resolve) => setTimeout(resolve, 0))
      downloadExpensesByDateCSV(expenses, { tripName: safeTripName, currency: resolvedCurrency })
      toast.success("CSV report downloaded")
    } catch (error) {
      console.error(error)
      toast.error("Failed to export CSV report")
    } finally {
      setExportingCsv(false)
    }
  }

  // Calculate summary statistics
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const averageExpense = expenses.length > 0 ? totalAmount / expenses.length : 0
  const uniquePayers = new Set(expenses.map((e) => e.paid_by)).size
  const uniqueCategories = new Set(expenses.map((e) => e.category).filter(Boolean)).size

  const overviewStats = useMemo(
    () => [
      {
        title: "Total Spent",
        helper: `${expenses.length} expenses`,
        value: formatCurrency(totalAmount),
        icon: Banknote,
      },
      {
        title: "Average",
        helper: "per expense",
        value: formatCurrency(averageExpense),
        icon: TrendingUp,
      },
      {
        title: "Contributors",
        helper: "people",
        value: uniquePayers.toString(),
        icon: Users,
      },
      {
        title: "Categories",
        helper: "different types",
        value: uniqueCategories.toString(),
        icon: Calendar,
      },
    ],
    [averageExpense, expenses.length, formatCurrency, totalAmount, uniqueCategories, uniquePayers],
  )

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

  const topCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5)

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

  const shouldShowPieLabels = categoryChartData.length <= 5

  return (
    <div className={className} dir="ltr">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="glass"
            size="sm"
            onClick={handleExportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            <span>Export PDF</span>
          </Button>
          <Button
            type="button"
            variant="ghostLight"
            size="sm"
            onClick={handleExportCsv}
            disabled={exportingCsv}
          >
            {exportingCsv ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span>Export CSV</span>
          </Button>
        </div>
        <SummaryTabs idPrefix={tabsIdPrefix} value={selectedTab} onChange={setSelectedTab} />

        {selectedTab === "Overview" && (
          <div
            role="tabpanel"
            id={getPanelId(tabsIdPrefix, "Overview")}
            aria-labelledby={getTabId(tabsIdPrefix, "Overview")}
            tabIndex={0}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {overviewStats.map(({ title, helper, value, icon: Icon }) => (
                <Card key={title} className="border border-white/10 bg-white/5">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-sm font-semibold tracking-tight text-white">{title}</CardTitle>
                      <CardDescription className="text-xs text-white/60">{helper}</CardDescription>
                    </div>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10">
                      <Icon className="h-4 w-4 text-white/80" />
                    </span>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="numeric-display text-3xl font-bold text-white" dir="ltr">{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border border-white/10">
              <CardHeader>
                <CardTitle>Top Categories</CardTitle>
                <CardDescription>Highest spending by category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topCategories.map(([category, data]) => {
                  const percentage = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: colorForKey(category) }}
                          />
                          <div className="min-w-0 text-left">
                            <p dir="auto" className="truncate-1 text-sm font-semibold text-white">
                              {category}
                            </p>
                            <p className="text-xs text-white/60">{data.count} expenses</p>
                          </div>
                        </div>
                        <div className="text-right" dir="ltr">
                          <span className="grad-text numeric-display text-sm font-semibold">
                            {formatCurrency(data.total)}
                          </span>
                          <p className="text-xs text-white/60">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{ backgroundColor: colorForKey(category), width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
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
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Amount"]} />
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
                      <div key={index} className="glass-sm flex w-full items-center gap-3 rounded-2xl p-3" dir="ltr">
                        <div className="min-w-0 text-left">
                          <p dir="auto" className="truncate-1 text-balance text-sm font-semibold text-white">
                            {balance.from} owes {balance.to}
                          </p>
                          <p className="truncate-2 text-xs text-white/70 leading-tight">Settlement balance</p>
                        </div>
                        <div className="ml-auto flex-none text-right">
                          <p className="grad-text numeric-display text-lg font-bold">{formatCurrency(balance.amount)}</p>
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
                      <div key={payer} className="glass-sm rounded-2xl p-4" dir="ltr">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className="h-4 w-4 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: colorForKey(payer) }}
                            />
                            <div className="min-w-0 text-left">
                              <h4 dir="auto" className="truncate-1 text-balance font-semibold text-white">
                                {payer}
                              </h4>
                              <p className="truncate-2 text-sm text-white/70 leading-tight">{data.count} expenses</p>
                            </div>
                          </div>
                          <div className="text-right" dir="ltr">
                            <p className="grad-text numeric-display text-lg font-bold">{formatCurrency(data.total)}</p>
                            <p className="text-sm text-white/70">
                              Avg {formatCurrency(data.total / data.count)} per expense
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
                    <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={shouldShowPieLabels}
                        label={
                          shouldShowPieLabels
                            ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
                            : undefined
                        }
                        outerRadius="75%"
                        dataKey="amount"
                      >
                        {categoryChartData.map((entry) => (
                          <Cell key={entry.name} fill={colorForKey(entry.name)} strokeWidth={1} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Amount"]} />
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
                    .map(([category, data]) => {
                      const share = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0
                      return (
                        <div key={category} className="glass-sm flex w-full flex-col gap-2 rounded-2xl p-3" dir="ltr">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div
                                className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: colorForKey(category) }}
                              />
                              <div className="min-w-0 text-left">
                                <p dir="auto" className="truncate-1 text-balance font-medium text-white">
                                  {category}
                                </p>
                                <p className="truncate-2 text-xs text-white/70 leading-tight">{data.count} expenses</p>
                              </div>
                            </div>
                            <div className="text-right" dir="ltr">
                              <p className="grad-text numeric-display font-semibold">{formatCurrency(data.total)}</p>
                              <p className="text-xs text-white/60">{share.toFixed(1)}%</p>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full"
                              style={{ backgroundColor: colorForKey(category), width: `${Math.min(share, 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
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
                          name === "amount" ? formatCurrency(Number(value)) : value,
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
                      <div key={date} className="glass-sm flex w-full items-center gap-3 rounded-2xl p-3" dir="ltr">
                        <div className="min-w-0 text-left">
                          <p className="truncate-1 text-balance font-medium text-white">
                            {new Date(date).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p className="truncate-2 text-sm text-white/70 leading-tight">{data.count} expenses</p>
                        </div>
                        <div className="ml-auto flex-none text-right" dir="ltr">
                          <p className="grad-text numeric-display font-semibold">{formatCurrency(data.total)}</p>
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
