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
      <Card className="glass rounded-[28px]">
        <CardContent className="py-12 text-center text-white/80">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Plus className="h-8 w-8 text-white/60" />
          </div>
          <p className="mb-1 text-lg font-medium text-white">No expenses yet</p>
          <p className="text-sm text-white/70">Add your first expense to get started</p>
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
          <div className="mb-4 flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">
              {new Date(date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h3>
            <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/80 numeric-display">
              ₪{dayExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
            </span>
          </div>

          <div className="space-y-3">
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
            
            {/* Desktop version */}
            {dayExpenses.map((expense) => (
              <Card
                key={`desktop-${expense.id}`}
                className={`hidden rounded-[28px] border-0 bg-transparent text-white shadow-lg transition-all duration-200 md:block ${
                  editingExpense?.id === expense.id ? "ring-2 ring-white/40 shadow-2xl" : ""
                }`}
              >
                <CardContent className="glass p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="mb-3 flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 dir="auto" className="text-xl font-semibold leading-tight text-white">
                            {expense.title || "Untitled Expense"}
                          </h4>
                          {expense.description && (
                            <p dir="auto" className="mt-1 text-sm text-white/70">{expense.description}</p>
                          )}
                          {expense.location && (
                            <div className="mt-1 flex items-center gap-1 text-white/70">
                              <MapPin className="h-4 w-4" />
                              <span dir="auto" className="text-sm">{expense.location}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <p className="grad-text numeric-display text-3xl font-extrabold">₪{expense.amount.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2 text-white/80">
                            {expense.paid_by === "Both" ? (
                              <Users className="h-4 w-4" />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                            <span dir="auto" className="text-sm font-medium">
                              {expense.paid_by === "Both" ? "Paid by Both" : `Paid by ${expense.paid_by}`}
                            </span>
                          </div>
                          {expense.category && (
                            (() => {
                              const Icon = categoryIcons[expense.category]
                              return (
                                <span className="glass-sm flex items-center gap-1 rounded-full px-3 py-1 text-sm text-white/90">
                                  <Icon className="h-4 w-4" />
                                  {expense.category}
                                </span>
                              )
                            })()
                          )}
                          {expense.is_shared_payment && (
                            <span className="glass-sm rounded-full px-3 py-1 text-sm text-white">
                              Shared
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-white/60">
                            {formatDistanceToNow(new Date(expense.created_at), { addSuffix: true })}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="glass-sm h-9 w-9 rounded-full p-0 text-white/80 transition hover:text-white"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-sm border-none bg-transparent backdrop-blur">
                              <DropdownMenuItem
                                onClick={() => handleEdit(expense)}
                                className="flex items-center gap-2 rounded-lg text-white/90 focus:text-white"
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(expense)}
                                className="flex items-center gap-2 text-red-300 focus:text-red-200"
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
