"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Expense } from "@/lib/supabase/client"
import { supabase } from "@/lib/supabase/client"
import { formatDistanceToNow } from "date-fns"
import { MoreVertical, Edit, Trash2, MapPin, User, Users } from "lucide-react"
import { categoryIcons } from "@/lib/category-icons"
import { EditExpenseForm } from "./edit-expense-form"
import { ExpenseCardMobile } from "./expense-card-mobile"
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
      <div className="glass rounded-[var(--radius-xxl)] py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
          <Plus className="h-6 w-6 text-white/30" />
        </div>
        <p className="text-sm font-medium text-white/60">No expenses yet</p>
        <p className="mt-1 text-xs text-white/30">Add your first expense to get started</p>
      </div>
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
    <div className="space-y-6">
      {editingExpense && (
        <EditExpenseForm
          expense={editingExpense}
          onExpenseUpdated={handleExpenseUpdated}
          onCancel={() => setEditingExpense(null)}
        />
      )}

      {Object.entries(groupedExpenses).map(([date, dayExpenses]) => (
        <div key={date}>
          {/* Date group header */}
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-medium text-white/50">
              {new Date(date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </h3>
            <div className="h-px flex-1 bg-white/6" />
            <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-white/50 numeric-display">
              ₪{dayExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
            </span>
          </div>

          <div className="space-y-2">
            {/* Mobile cards */}
            {dayExpenses.map((expense) => (
              <div key={expense.id} className="md:hidden">
                <ExpenseCardMobile
                  expense={expense}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isDeleting={deletingExpense === expense.id}
                />
              </div>
            ))}

            {/* Desktop cards */}
            {dayExpenses.map((expense) => {
              const CategoryIcon = expense.category ? categoryIcons[expense.category] : null
              return (
                <div
                  key={`desktop-${expense.id}`}
                  className={`hidden md:block glass rounded-[var(--radius-xxl)] p-5 transition-all duration-200 hover:border-white/16 ${
                    editingExpense?.id === expense.id ? "ring-1 ring-white/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="mb-3 flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 dir="auto" className="text-base font-semibold text-white">
                            {expense.title || "Untitled Expense"}
                          </h4>
                          {expense.description && (
                            <p dir="auto" className="mt-0.5 text-sm text-white/40">{expense.description}</p>
                          )}
                          {expense.location && (
                            <div className="mt-1 flex items-center gap-1 text-white/40">
                              <MapPin className="h-3 w-3" />
                              <span dir="auto" className="text-xs">{expense.location}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <p className="grad-text numeric-display text-2xl font-bold">₪{expense.amount.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 text-white/50">
                            {expense.paid_by === "Both" ? (
                              <Users className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            <span dir="auto" className="text-xs">
                              {expense.paid_by === "Both" ? "Both" : expense.paid_by}
                            </span>
                          </div>
                          {expense.category && CategoryIcon && (
                            <span className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-xs text-white/60">
                              <CategoryIcon className="h-3 w-3" />
                              {expense.category}
                            </span>
                          )}
                          {expense.is_shared_payment && (
                            <span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs text-white/60">
                              Shared
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/30">
                            {formatDistanceToNow(new Date(expense.created_at), { addSuffix: true })}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghostLight"
                                size="sm"
                                className="h-7 w-7 rounded-lg p-0 text-white/30 hover:text-white/70"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-strong border-none">
                              <DropdownMenuItem
                                onClick={() => handleEdit(expense)}
                                className="flex items-center gap-2 rounded-lg text-white/80 focus:text-white"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(expense)}
                                className="flex items-center gap-2 text-red-300 focus:text-red-200"
                                disabled={deletingExpense === expense.id}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {deletingExpense === expense.id ? "Deleting..." : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
