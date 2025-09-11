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
          className="h-full px-6 bg-[color:var(--color-primary50)] hover:bg-[color:var(--color-primary500)] text-[color:var(--color-primary)] rounded-none"
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
          className="h-full px-6 bg-red-100 hover:bg-red-200 text-red-700 rounded-none"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Main card */}
      <Card
        ref={cardRef}
        className={`bg-white/70 backdrop-blur-sm border-white/40 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl relative ${
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
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-3">
              {/* Title and Amount Row */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 dir="auto" className="font-semibold text-gray-900 text-base leading-tight truncate">
                    {expense.title || "Untitled Expense"}
                  </h4>
                  {expense.description && (
                    <p dir="auto" className="text-sm text-gray-600 mt-0.5 line-clamp-1">
                      {expense.description}
                    </p>
                  )}
                </div>
                <div className="text-end ms-3 flex-shrink-0">
                  <p className="text-xl font-bold text-gray-900">₪{expense.amount.toFixed(2)}</p>
                </div>
              </div>

              {/* Location */}
              {expense.location && (
                <div className="flex items-center gap-1 mb-2">
                  <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                  <span dir="auto" className="text-sm text-gray-600 truncate">{expense.location}</span>
                </div>
              )}

              {/* Bottom row with payer, category, and time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Payer */}
                  <div className="flex items-center gap-1 min-w-0">
                    {expense.paid_by === "Both" ? (
                      <Users className="h-3 w-3 text-[color:var(--color-primary)] flex-shrink-0" />
                    ) : (
                      <User className="h-3 w-3 text-gray-500 flex-shrink-0" />
                    )}
                    <span dir="auto" className="text-xs font-medium text-gray-700 truncate">
                      {expense.paid_by === "Both" ? "Both" : expense.paid_by}
                    </span>
                  </div>
                  
                  {/* Category */}
                  {expense.category && CategoryIcon && (
                    <span className="text-xs bg-[color:var(--color-primary50)] text-[color:var(--color-primary)] px-2 py-0.5 rounded-full font-medium flex-shrink-0 flex items-center gap-1">
                      <CategoryIcon className="h-3 w-3" />
                      {expense.category}
                    </span>
                  )}
                  {expense.is_shared_payment && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      Shared
                    </span>
                  )}
                </div>

                {/* Time and Menu */}
                <div className="flex items-center gap-2 flex-shrink-0 ms-2">
                  <span className="text-xs text-gray-500 font-medium">
                    {formatDistanceToNow(new Date(expense.created_at), { addSuffix: true })}
                  </span>
                  
                  {/* Kebab menu for desktop */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg transition-colors md:opacity-100 opacity-60"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-gray-200 shadow-lg">
                      <DropdownMenuItem
                        onClick={() => onEdit(expense)}
                        className="flex items-center gap-2 rounded-lg"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(expense)}
                        className="flex items-center gap-2 text-red-600 rounded-lg"
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