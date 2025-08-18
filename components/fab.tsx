"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FABProps {
  onClick: () => void
  disabled?: boolean
}

export function FAB({ onClick, disabled = false }: FABProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 md:hidden"
      style={{
        bottom: `calc(6rem + env(safe-area-inset-bottom))`
      }}
    >
      <Plus className="h-6 w-6" />
      <span className="sr-only">Add Expense</span>
    </Button>
  )
}