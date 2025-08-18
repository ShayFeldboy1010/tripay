"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Expense } from "@/lib/supabase/client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Users, Banknote, Calendar } from "lucide-react"
import { LocationsReport } from "@/components/locations-report"

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

  const calculateBalances = () => {
    const participants = Array.from(
      new Set(expenses.map((e) => e.paid_by).filter((p) => p !== "Both" && p !== "Multiple")),
    )
    const balances: Record<string, Record<string, number>> = {}

    // Initialize balance matrix
    participants.forEach((p1) => {
      balances[p1] = {}
      participants.forEach((p2) => {
        if (p1 !== p2) balances[p1][p2] = 0
      })
    })

    // Calculate who owes whom
    expenses.forEach((expense) => {
      if (expense.paid_by === "Both" || expense.paid_by === "Multiple" || expense.is_shared_payment) return // Skip shared expenses

      const payer = expense.paid_by
      const amountPerPerson = expense.amount / participants.length

      participants.forEach((participant) => {
        if (participant !== payer) {
          balances[participant][payer] += amountPerPerson
        }
      })
    })

    // Net out the balances (if A owes B $10 and B owes A $6, then A owes B $4)
    const netBalances: Array<{ from: string; to: string; amount: number }> = []

    participants.forEach((p1) => {
      participants.forEach((p2) => {
        if (p1 !== p2) {
          const debt1to2 = balances[p1][p2] || 0
          const debt2to1 = balances[p2][p1] || 0
          const netDebt = debt1to2 - debt2to1

          if (netDebt > 0.01) {
            // Only show debts > 1 cent
            netBalances.push({
              from: p1,
              to: p2,
              amount: netDebt,
            })
            // Clear the reverse debt to avoid double counting
            balances[p2][p1] = 0
          }
        }
      })
    })

    return netBalances.sort((a, b) => b.amount - a.amount)
  }

  const balances = calculateBalances()

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

  // Colors for pie chart
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"]

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
        <CardContent className="text-center py-8">
          <p className="text-gray-500">No expenses to analyze</p>
          <p className="text-sm text-gray-400 mt-1">Add some expenses to see reports</p>
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
                        <Badge variant="outline">{category}</Badge>
                        <span className="text-sm text-gray-600">{data.count} expenses</span>
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
                    <Bar dataKey="amount" fill="#3b82f6" />
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
                <p className="text-center text-gray-500 py-4">All balanced! No outstanding debts.</p>
              ) : (
                <div className="space-y-3">
                  {balances.map((balance, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{balance.from}</span>
                        <span className="text-gray-600">owes</span>
                        <span className="font-medium text-gray-900">{balance.to}</span>
                      </div>
                      <span className="font-bold text-orange-600">₪{balance.amount.toFixed(2)}</span>
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
                    <div key={payer} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{payer}</h4>
                        <div className="text-right">
                          <p className="font-bold text-lg">₪{data.total.toFixed(2)}</p>
                          <p className="text-sm text-gray-600">{data.count} expenses</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
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
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                  .map(([category, data], index) => (
                    <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium">{category}</p>
                          <p className="text-sm text-gray-600">{data.count} expenses</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">₪{data.total.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">{((data.total / totalAmount) * 100).toFixed(1)}%</p>
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
                    <Bar dataKey="amount" fill="#10b981" />
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
                    <div key={date} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {new Date(date).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-gray-600">{data.count} expenses</p>
                      </div>
                      <p className="font-semibold">₪{data.total.toFixed(2)}</p>
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
