"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
    
    // Only allow left swipe (positive difference)
    if (diff > 0) {
      setSwipeDistance(Math.min(diff, 120)) // Max swipe distance
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    
    // If swiped more than 60px, keep it partially open for actions
    if (swipeDistance > 60) {
      setSwipeDistance(80)
    } else {
      setSwipeDistance(0)
    }
  }

  const resetSwipe = () => {
    setSwipeDistance(0)
  }

  // Reset swipe when component is edited or deleted
  useEffect(() => {
    setSwipeDistance(0)
  }, [expense.id])

  const CategoryIcon = expense.category ? categoryIcons[expense.category] : null

  return (
    <div className="relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      {/* Action buttons behind the card */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center">
        <Button
          variant="ghost"
          onClick={() => {
            onEdit(expense)
            resetSwipe()
          }}
          className="h-full px-6 text-white/80 transition hover:bg-white/15 rounded-none"
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
          className="h-full px-6 rounded-none text-red-200 transition hover:bg-red-500/20"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Main card */}
      <Card
        ref={cardRef}
        className={`glass relative transition-all duration-200 ${
          isDragging ? 'transition-none' : 'transition-transform duration-300'
        }`}
        style={{
          transform: `translateX(-${swipeDistance}px)`
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={resetSwipe}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-3">
              {/* Title and Amount Row */}
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 dir="auto" className="text-base font-semibold leading-tight text-white truncate">
                    {expense.title || "Untitled Expense"}
                  </h4>
                  {expense.description && (
                    <p dir="auto" className="mt-1 text-sm text-white/70 line-clamp-1">
                      {expense.description}
                    </p>
                  )}
                </div>
                <div className="ms-3 flex-shrink-0 text-end">
                  <p className="grad-text numeric-display text-2xl font-bold">₪{expense.amount.toFixed(2)}</p>
                </div>
              </div>

              {/* Location */}
              {expense.location && (
                <div className="mb-2 flex items-center gap-1 text-white/70">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span dir="auto" className="truncate text-sm">{expense.location}</span>
                </div>
              )}

              {/* Bottom row with payer, category, and time */}
              <div className="flex items-center justify-between">
                <div className="flex flex-1 min-w-0 items-center gap-3">
                  {/* Payer */}
                  <div className="flex min-w-0 items-center gap-1 text-white/80">
                    {expense.paid_by === "Both" ? (
                      <Users className="h-3 w-3 flex-shrink-0 text-white/80" />
                    ) : (
                      <User className="h-3 w-3 flex-shrink-0 text-white/80" />
                    )}
                    <span dir="auto" className="truncate text-xs font-medium">
                      {expense.paid_by === "Both" ? "Both" : expense.paid_by}
                    </span>
                  </div>

                  {/* Category */}
                  {expense.category && CategoryIcon && (
                    <span className="glass-sm flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white/90">
                      <CategoryIcon className="h-3 w-3" />
                      {expense.category}
                    </span>
                  )}
                  {expense.is_shared_payment && (
                    <span className="glass-sm flex-shrink-0 rounded-full px-2 py-0.5 text-xs text-white">
                      Shared
                    </span>
                  )}
                </div>

                {/* Time and Menu */}
                <div className="ms-2 flex flex-shrink-0 items-center gap-2">
                  <span className="text-xs font-medium text-white/60">
                    {formatDistanceToNow(new Date(expense.created_at), { addSuffix: true })}
                  </span>

                  {/* Kebab menu for desktop */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="glass-sm h-8 w-8 rounded-full p-0 text-white/80 transition hover:text-white md:opacity-100 opacity-60"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-sm border-none bg-transparent backdrop-blur">
                      <DropdownMenuItem
                        onClick={() => onEdit(expense)}
                        className="flex items-center gap-2 rounded-lg text-white/90 focus:text-white"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(expense)}
                        className="flex items-center gap-2 rounded-lg text-red-300 focus:text-red-200"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
