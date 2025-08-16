"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Expense } from "@/lib/supabase/client"
import { supabase } from "@/lib/supabase/client"
import { formatDistanceToNow } from "date-fns"
import { MoreVertical, Edit, Trash2, MapPin, User, Users } from "lucide-react"
import { EditExpenseForm } from "./edit-expense-form"
import { Plus } from "lucide-react"

interface ExpenseListProps {
  expenses: Expense[]
  onExpenseUpdated: (expense: Expense) => void
  onExpenseDeleted: (expenseId: string) => void
}

export function ExpenseList({ expenses, onExpenseUpdated, onExpenseDeleted }: ExpenseListProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<string | null>(null)

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`Delete "${expense.description}"?`)) return

    setDeletingExpense(expense.id)
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expense.id)

      if (error) throw error

      onExpenseDeleted(expense.id)
    } catch (error) {
      console.error("Error deleting expense:", error)
      alert("Failed to delete expense. Please try again.")
    } finally {
      setDeletingExpense(null)
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
  }

  const handleExpenseUpdated = (updatedExpense: Expense) => {
    onExpenseUpdated(updatedExpense)
    setEditingExpense(null)
  }

  if (expenses.length === 0) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-white/40 shadow-lg rounded-2xl">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium mb-1">No expenses yet</p>
          <p className="text-sm text-gray-500">Add your first expense to get started</p>
        </CardContent>
      </Card>
    )
  }

  const groupedExpenses = expenses.reduce(
    (groups, expense) => {
      const date = new Date(expense.created_at).toDateString()
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(expense)
      return groups
    },
    {} as Record<string, Expense[]>,
  )

  return (
    <div className="space-y-8">
      {editingExpense && (
        <EditExpenseForm
          expense={editingExpense}
          onExpenseUpdated={handleExpenseUpdated}
          onCancel={() => setEditingExpense(null)}
        />
      )}

      {Object.entries(groupedExpenses).map(([date, dayExpenses]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {new Date(date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h3>
            <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent"></div>
            <span className="text-sm font-medium text-gray-500 bg-white/60 px-3 py-1 rounded-full">
              ₪{dayExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
            </span>
          </div>

          <div className="space-y-3">
            {dayExpenses.map((expense) => (
              <Card
                key={expense.id}
                className={`bg-white/70 backdrop-blur-sm border-white/40 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl ${
                  editingExpense?.id === expense.id ? "ring-2 ring-blue-400 shadow-lg" : ""
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-lg leading-tight">
                            {expense.title || "Untitled Expense"}
                          </h4>
                          {expense.description && <p className="text-sm text-gray-600 mt-1">{expense.description}</p>}
                          {expense.location && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="text-sm text-gray-600">{expense.location}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">₪{expense.amount.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {expense.paid_by === "Both" ? (
                              <Users className="h-4 w-4 text-blue-600" />
                            ) : (
                              <User className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="text-sm font-medium text-gray-700">
                              {expense.paid_by === "Both" ? "Paid by Both" : `Paid by ${expense.paid_by}`}
                            </span>
                          </div>
                          {expense.category && (
                            <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                              {expense.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium">
                            {formatDistanceToNow(new Date(expense.created_at), { addSuffix: true })}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <MoreVertical className="h-4 w-4 text-gray-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-gray-200 shadow-lg">
                              <DropdownMenuItem
                                onClick={() => handleEdit(expense)}
                                className="flex items-center gap-2 rounded-lg"
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(expense)}
                                className="flex items-center gap-2 text-red-600 rounded-lg"
                                disabled={deletingExpense === expense.id}
                              >
                                <Trash2 className="h-4 w-4" />
                                {deletingExpense === expense.id ? "Deleting..." : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
