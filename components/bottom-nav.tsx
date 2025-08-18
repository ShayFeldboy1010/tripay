"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Receipt, PlusCircle, PieChart, Settings } from "lucide-react"

interface BottomNavProps {
  tripId: string
  onAdd: () => void
  onExpenses: () => void
  onSummary: () => void
  showSummary: boolean
}

export function BottomNav({ tripId, onAdd, onExpenses, onSummary, showSummary }: BottomNavProps) {
  const pathname = usePathname()
  const basePath = `/trip/${tripId}`
  const isSettings = pathname.startsWith(`${basePath}/settings`)
  const isExpenses = !showSummary && !isSettings

  return (
    <nav
      className="fixed bottom-0 inset-x-0 border-t bg-white/80 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        <button
          onClick={onExpenses}
          className={`flex flex-col items-center justify-center gap-1 py-2 ${isExpenses ? "text-blue-600" : "text-gray-600"}`}
        >
          <Receipt className="h-5 w-5" />
          <span className="text-xs">Expenses</span>
        </button>
        <button
          onClick={onAdd}
          className="flex flex-col items-center justify-center gap-1 py-2 text-gray-600"
        >
          <PlusCircle className="h-5 w-5" />
          <span className="text-xs">Add</span>
        </button>
        <button
          onClick={onSummary}
          className={`flex flex-col items-center justify-center gap-1 py-2 ${showSummary ? "text-blue-600" : "text-gray-600"}`}
        >
          <PieChart className="h-5 w-5" />
          <span className="text-xs">Summary</span>
        </button>
        <Link
          href={`${basePath}/settings`}
          className={`flex flex-col items-center justify-center gap-1 py-2 ${isSettings ? "text-blue-600" : "text-gray-600"}`}
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs">Settings</span>
        </Link>
      </div>
    </nav>
  )
}

