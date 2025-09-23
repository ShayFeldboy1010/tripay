"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Expense } from "@/lib/supabase/client"
import { calculateBalances } from "@/lib/balance"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Users, Banknote, Calendar } from "lucide-react"
import { LocationsReport } from "@/components/locations-report"
import { colorForKey } from "@/lib/chartColors"

interface ExpenseReportsProps {
  expenses: Expense[]
  className?: string
}

export function ExpenseReports({ expenses, className }: ExpenseReportsProps) {
  const [selectedTab, setSelectedTab] = useState("overview")

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
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₪{totalAmount.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{expenses.length} expenses</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₪{averageExpense.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">per expense</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contributors</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{uniquePayers}</div>
                <p className="text-xs text-muted-foreground">people</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{uniqueCategories}</div>
                <p className="text-xs text-muted-foreground">different types</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Categories */}
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
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          dir="auto"
                          className="text-white"
                          style={{ backgroundColor: colorForKey(category), borderColor: colorForKey(category) }}
                        >
                          {category}
                        </Badge>
                        <span className="text-sm text-white/70">{data.count} expenses</span>
                      </div>
                      <span className="font-semibold">₪{data.total.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="people" className="space-y-4">
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
                    <div key={index} className="glass-sm flex items-center justify-between rounded-2xl p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{balance.from}</span>
                        <span className="text-white/70">owes</span>
                        <span className="font-medium text-white">{balance.to}</span>
                      </div>
                      <span className="grad-text text-lg font-bold">₪{balance.amount.toFixed(2)}</span>
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
                    <div key={payer} className="glass-sm space-y-2 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: colorForKey(payer) }}
                          />
                          <h4 dir="auto" className="font-semibold text-white">
                            {payer}
                          </h4>
                        </div>
                        <div className="text-end">
                          <p className="grad-text text-lg font-bold">₪{data.total.toFixed(2)}</p>
                          <p className="text-sm text-white/70">{data.count} expenses</p>
                        </div>
                      </div>
                      <div className="text-sm text-white/70">
                        Average: ₪{(data.total / data.count).toFixed(2)} per expense
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
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
                    <div key={category} className="glass-sm flex items-center justify-between rounded-2xl p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: colorForKey(category) }}
                        />
                        <div>
                          <p dir="auto" className="font-medium text-white">{category}</p>
                          <p className="text-sm text-white/70">{data.count} expenses</p>
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="grad-text font-semibold">₪{data.total.toFixed(2)}</p>
                        <p className="text-sm text-white/70">{((data.total / totalAmount) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <LocationsReport expenses={expenses} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Spending Timeline</CardTitle>
              <CardDescription>Daily spending pattern</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => [
                        /* Changed $ to ₪ in tooltip formatter */
                        name === "amount" ? `₪${Number(value).toFixed(2)}` : value,
                        name === "amount" ? "Amount" : "Count",
                      ]}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--chart-1))" />
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
                    <div key={date} className="glass-sm flex items-center justify-between rounded-2xl p-3">
                      <div>
                        <p className="font-medium text-white">
                          {new Date(date).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-white/70">{data.count} expenses</p>
                      </div>
                      <p className="grad-text font-semibold">₪{data.total.toFixed(2)}</p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
