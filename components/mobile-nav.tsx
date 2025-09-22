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
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-2xl px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="glass flex items-center justify-between rounded-3xl px-4 py-3 text-white/80 backdrop-saturate-150">
          <Link
            href={`/trip/${tripId}`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1 text-xs transition",
              active === "expenses" ? "text-white font-medium" : "text-white/60",
            )}
          >
            <Home className="h-5 w-5" />
            <span>Expenses</span>
          </Link>
          <Link
            href={`/trip/${tripId}/summary`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1 text-xs transition",
              active === "summary" ? "text-white font-medium" : "text-white/60",
            )}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Summary</span>
          </Link>
          <Link
            href={`/trip/${tripId}/search`}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1 text-xs transition",
              active === "search" ? "text-white font-medium" : "text-white/60",
            )}
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
