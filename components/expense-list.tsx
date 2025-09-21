"use client"

import { useMemo, useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Expense } from "@/lib/supabase/client"
import { supabase } from "@/lib/supabase/client"
import { categoryIcons } from "@/lib/category-icons"
import { EditExpenseForm } from "./edit-expense-form"
import {
  Clock,
  Edit,
  MapPin,
  MoreVertical,
  Plus,
  Trash2,
  User,
  Users,
} from "lucide-react"

interface ExpenseListProps {
  expenses: Expense[]
  onExpenseUpdated: (expense: Expense) => void
  onExpenseDeleted: (expenseId: string) => void
}

export function ExpenseList({ expenses, onExpenseUpdated, onExpenseDeleted }: ExpenseListProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<string | null>(null)

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("he-IL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  )
  const countFormatter = useMemo(() => new Intl.NumberFormat("he-IL"), [])
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [],
  )
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  )

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`למחוק את "${expense.title || expense.description || "הוצאה"}"?`)) return

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
      <div className="glass rounded-3xl p-12 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-200 text-white/85">
          <Plus className="size-8" />
        </div>
        <p className="mt-6 text-lg font-semibold text-white/90">עדיין אין הוצאות</p>
        <p className="mt-2 text-sm text-white/60">התחילו להוסיף הוצאות כדי לעקוב אחרי ההתקדמות של הטיול.</p>
      </div>
    )
  }

  const groupedByDate = expenses.reduce((groups, expense) => {
    const dayIso = new Date(expense.created_at).toISOString().split("T")[0]
    if (!groups[dayIso]) {
      groups[dayIso] = []
    }
    groups[dayIso].push(expense)
    return groups
  }, {} as Record<string, Expense[]>)

  const sortedDays = Object.entries(groupedByDate)
    .map(([isoDate, dayExpenses]) => [isoDate, [...dayExpenses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())] as const)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())

  return (
    <div className="space-y-6 sm:space-y-8">
      {editingExpense && (
        <EditExpenseForm
          expense={editingExpense}
          onExpenseUpdated={handleExpenseUpdated}
          onCancel={() => setEditingExpense(null)}
        />
      )}

      {sortedDays.map(([isoDate, dayExpenses]) => {
        const date = new Date(isoDate)
        const dayLabel = dateFormatter.format(date)
        const detailedLabel = date.toLocaleDateString("he-IL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
        const dayTotal = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0)

        return (
          <section key={isoDate} className="gradient-border rounded-[1.25rem]">
            <div className="glass rounded-2xl p-5 sm:p-6">
              <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">ציר ההוצאות</p>
                  <h3 className="mt-1 text-xl font-semibold text-white/95">{dayLabel}</h3>
                  <p className="text-sm text-white/50">{detailedLabel}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-200 px-3 py-1 text-sm font-semibold text-white/90 shadow-glass"
                    dir="ltr"
                  >
                    ₪{currencyFormatter.format(dayTotal)}
                  </span>
                  <span className="text-xs text-white/60">{countFormatter.format(dayExpenses.length)} הוצאות ביום זה</span>
                </div>
              </header>

              <div className="mt-6 space-y-4">
                {dayExpenses.map((expense) => {
                  const CategoryIcon = categoryIcons[expense.category]
                  const timeLabel = timeFormatter.format(new Date(expense.created_at))

                  return (
                    <article
                      key={expense.id}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/0 p-4 transition hover:border-primary-200 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-3xl bg-primary-200 text-white/90 shadow-glass">
                          <CategoryIcon className="size-5" />
                        </div>
                        <div className="min-w-0 space-y-3">
                          <div className="space-y-1">
                            <h4 dir="auto" className="text-lg font-semibold leading-tight text-white/90">
                              {expense.title || "הוצאה ללא שם"}
                            </h4>
                            {expense.description && (
                              <p dir="auto" className="text-sm text-white/60">
                                {expense.description}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/55">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3.5" />
                              <span>{timeLabel}</span>
                            </span>
                            {expense.location && (
                              <span className="inline-flex items-center gap-1" dir="auto">
                                <MapPin className="size-3.5" />
                                <span>{expense.location}</span>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1" dir="auto">
                              {expense.paid_by === "Both" ? (
                                <Users className="size-3.5" />
                              ) : (
                                <User className="size-3.5" />
                              )}
                              <span>
                                {expense.paid_by === "Both"
                                  ? "שולם ביחד"
                                  : expense.paid_by
                                  ? `שולם ע"י ${expense.paid_by}`
                                  : "שולם"}
                              </span>
                            </span>
                            {expense.category && (
                              <span className="inline-flex items-center gap-1 rounded-xl bg-primary-100 px-3 py-1 font-medium text-white/80">
                                <CategoryIcon className="size-3.5" />
                                {expense.category}
                              </span>
                            )}
                            {expense.is_shared_payment && (
                              <span className="rounded-xl bg-primary-100 px-3 py-1 font-medium text-white/80">
                                תשלום משותף
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full items-end justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                        <span
                          className="inline-flex items-center gap-2 rounded-xl bg-primary-200 px-3 py-1 text-sm font-semibold text-white/90 shadow-glass"
                          dir="ltr"
                        >
                          ₪{currencyFormatter.format(expense.amount)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex size-10 items-center justify-center rounded-2xl bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15"
                              aria-label="פעולות הוצאה"
                            >
                              <MoreVertical className="size-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="min-w-[180px] rounded-2xl border border-white/10 bg-base-800/95 p-1 text-white/80 shadow-glass backdrop-blur-xl"
                          >
                            <DropdownMenuItem
                              onClick={() => handleEdit(expense)}
                              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/85 focus:bg-primary-200 focus:text-white"
                            >
                              <Edit className="size-4" />
                              עריכה
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(expense)}
                              disabled={deletingExpense === expense.id}
                              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 focus:bg-primary-200 focus:text-white disabled:opacity-60"
                            >
                              <Trash2 className="size-4" />
                              {deletingExpense === expense.id ? "מוחק..." : "מחיקה"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
