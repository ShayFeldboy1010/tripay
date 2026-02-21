"use client"

import Link from "next/link";
import { Home, BarChart3, Search } from "lucide-react";
import clsx from "clsx";

interface MobileNavProps {
  tripId: string;
  active: "expenses" | "summary" | "search";
}

export function MobileNav({ tripId, active }: MobileNavProps) {
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-2xl px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="glass flex items-center justify-around rounded-2xl px-2 py-2 backdrop-saturate-150">
          <Link
            href={`/trip/${tripId}`}
            className={clsx(
              "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[10px] transition-all duration-200",
              active === "expenses"
                ? "text-white font-medium bg-white/8"
                : "text-white/45 hover:text-white/70",
            )}
          >
            <Home className="h-5 w-5" />
            <span>Expenses</span>
          </Link>
          <Link
            href={`/trip/${tripId}/summary`}
            className={clsx(
              "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[10px] transition-all duration-200",
              active === "summary"
                ? "text-white font-medium bg-white/8"
                : "text-white/45 hover:text-white/70",
            )}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Summary</span>
          </Link>
          <Link
            href={`/trip/${tripId}/search`}
            className={clsx(
              "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[10px] transition-all duration-200",
              active === "search"
                ? "text-white font-medium bg-white/8"
                : "text-white/45 hover:text-white/70",
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
