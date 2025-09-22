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
        <div className="glass flex justify-around rounded-t-3xl border border-white/10 bg-base-800/80 px-2 py-3 text-white/70 backdrop-blur-xl">
          <Link
            href={`/trip/${tripId}`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs transition-colors",
              active === "expenses" ? "font-semibold" : "text-white/60 hover:text-white/80",
            )}
            style={
              active === "expenses"
                ? { backgroundColor: colors.primary500, color: colors.onPrimary }
                : undefined
            }
          >
            <Home className="h-5 w-5" />
            <span>Expenses</span>
          </Link>
          <Link
            href={`/trip/${tripId}/summary`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs transition-colors",
              active === "summary" ? "font-semibold" : "text-white/60 hover:text-white/80",
            )}
            style={
              active === "summary"
                ? { backgroundColor: colors.primary500, color: colors.onPrimary }
                : undefined
            }
          >
            <BarChart3 className="h-5 w-5" />
            <span>Summary</span>
          </Link>
          <Link
            href={`/trip/${tripId}/search`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs transition-colors",
              active === "search" ? "font-semibold" : "text-white/60 hover:text-white/80",
            )}
            style={
              active === "search"
                ? { backgroundColor: colors.primary500, color: colors.onPrimary }
                : undefined
            }
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
