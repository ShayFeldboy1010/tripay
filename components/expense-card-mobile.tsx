"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Expense } from "@/lib/supabase/client"
import { formatDistanceToNow } from "date-fns"
import { MoreVertical, Edit, Trash2, MapPin, User, Users } from "lucide-react"
import { categoryIcons } from "@/lib/category-icons"

interface ExpenseCardMobileProps {
  expense: Expense
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
  isDeleting?: boolean
}

export function ExpenseCardMobile({ expense, onEdit, onDelete, isDeleting = false }: ExpenseCardMobileProps) {
  const [swipeDistance, setSwipeDistance] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const currentX = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    currentX.current = e.touches[0].clientX
    const diff = startX.current - currentX.current
    if (diff > 0) {
      setSwipeDistance(Math.min(diff, 120))
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (swipeDistance > 60) {
      setSwipeDistance(80)
    } else {
      setSwipeDistance(0)
    }
  }

  const resetSwipe = () => {
    setSwipeDistance(0)
  }

  useEffect(() => {
    setSwipeDistance(0)
  }, [expense.id])

  const CategoryIcon = expense.category ? categoryIcons[expense.category] : null

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xxl)] animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Swipe actions */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center">
        <Button
          variant="ghost"
          onClick={() => {
            onEdit(expense)
            resetSwipe()
          }}
          className="h-full px-5 text-white/60 transition hover:bg-white/10 rounded-none"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onDelete(expense)
            resetSwipe()
          }}
          disabled={isDeleting}
          className="h-full px-5 rounded-none text-red-300/70 transition hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        className={`glass relative ${
          isDragging ? '' : 'transition-transform duration-300'
        }`}
        style={{ transform: `translateX(-${swipeDistance}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={resetSwipe}
      >
        <div className="p-4">
          {/* Title + Amount */}
          <div className="mb-2 flex items-start justify-between">
            <div className="flex-1 min-w-0 pe-3">
              <h4 dir="auto" className="text-sm font-semibold text-white truncate">
                {expense.title || "Untitled Expense"}
              </h4>
              {expense.description && (
                <p dir="auto" className="mt-0.5 text-xs text-white/40 line-clamp-1">
                  {expense.description}
                </p>
              )}
            </div>
            <p className="grad-text numeric-display text-lg font-bold flex-shrink-0">
              ₪{expense.amount.toFixed(2)}
            </p>
          </div>

          {/* Location */}
          {expense.location && (
            <div className="mb-2 flex items-center gap-1 text-white/35">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span dir="auto" className="truncate text-xs">{expense.location}</span>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between">
            <div className="flex flex-1 min-w-0 items-center gap-2">
              <div className="flex min-w-0 items-center gap-1 text-white/45">
                {expense.paid_by === "Both" ? (
                  <Users className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <User className="h-3 w-3 flex-shrink-0" />
                )}
                <span dir="auto" className="truncate text-[10px] font-medium">
                  {expense.paid_by === "Both" ? "Both" : expense.paid_by}
                </span>
              </div>

              {expense.category && CategoryIcon && (
                <span className="flex flex-shrink-0 items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                  <CategoryIcon className="h-2.5 w-2.5" />
                  {expense.category}
                </span>
              )}
              {expense.is_shared_payment && (
                <span className="flex-shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                  Shared
                </span>
              )}
            </div>

            <div className="ms-2 flex flex-shrink-0 items-center gap-1.5">
              <span className="text-[10px] text-white/25">
                {formatDistanceToNow(new Date(expense.created_at), { addSuffix: true })}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghostLight"
                    size="sm"
                    className="h-6 w-6 rounded-md p-0 text-white/25 hover:text-white/60"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong border-none">
                  <DropdownMenuItem
                    onClick={() => onEdit(expense)}
                    className="flex items-center gap-2 rounded-lg text-white/80 focus:text-white"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(expense)}
                    className="flex items-center gap-2 rounded-lg text-red-300 focus:text-red-200"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
