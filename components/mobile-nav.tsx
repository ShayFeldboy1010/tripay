"use client"

import { usePathname, useRouter } from "next/navigation"
import { Home, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MobileNavProps {
  tripId?: string
}

export function MobileNav({ tripId }: MobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isHome = pathname === "/"
  const isExpenses = pathname === `/trip/${tripId}`
  
  // Don't show nav on home page
  if (isHome) return null

  const navItems = [
    {
      id: "expenses",
      label: "Expenses",
      icon: Home,
      active: isExpenses,
      onClick: () => {
        router.push(`/trip/${tripId}`)
        window.dispatchEvent(new CustomEvent('showExpenses'))
      }
    },
    {
      id: "summary",
      label: "Summary",
      icon: BarChart3,
      active: false,
      onClick: () => {
        window.dispatchEvent(new CustomEvent('toggleReports'))
      }
    },
  ]

  return (
    <>
      {/* Spacer to prevent content from being hidden behind fixed nav */}
      <div className="h-20 md:hidden" />
      
      {/* Bottom navigation - only visible on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 md:hidden">
        <div 
          className="safe-area-pb"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={item.onClick}
                  className={`flex-1 flex flex-col items-center gap-1 h-16 px-2 rounded-xl transition-all duration-200 ${
                    item.active
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Button>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}