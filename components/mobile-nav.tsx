"use client"

import Link from "next/link";
import { Home, BarChart3, Search } from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/theme/ThemeProvider";

interface MobileNavProps {
  tripId: string;
  active: "expenses" | "summary" | "search";
}

export function MobileNav({ tripId, active }: MobileNavProps) {
  const { colors } = useTheme();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40">
      <div className="max-w-2xl mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around rounded-t-2xl bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)] py-2">
          <Link
            href={`/trip/${tripId}`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 px-2 py-1 rounded-xl text-xs",
              active === "expenses" ? "font-medium" : "text-gray-600",
            )}
            style={active === "expenses" ? { color: colors.primary } : undefined}
          >
            <Home className="h-5 w-5" />
            <span>Expenses</span>
          </Link>
          <Link
            href={`/trip/${tripId}/summary`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 px-2 py-1 rounded-xl text-xs",
              active === "summary" ? "font-medium" : "text-gray-600",
            )}
            style={active === "summary" ? { color: colors.primary } : undefined}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Summary</span>
          </Link>
          <Link
            href={`/trip/${tripId}/search`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 px-2 py-1 rounded-xl text-xs",
              active === "search" ? "font-medium" : "text-gray-600",
            )}
            style={active === "search" ? { color: colors.primary } : undefined}
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
