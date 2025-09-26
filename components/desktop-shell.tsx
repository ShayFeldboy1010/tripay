"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Home, BarChart3, Search as SearchIcon } from "lucide-react";
import clsx from "clsx";
import { OfflineIndicator } from "@/components/offline-indicator";
import { TripSettingsDropdown } from "@/components/trip-settings-dropdown";
import { AddSplitButton } from "@/components/add-split-button";

interface DesktopShellProps {
  tripId: string;
  active: "expenses" | "summary" | "search";
  children: ReactNode;
  onAddExpense: () => void;
  onAddParticipants: () => void;
  onAddLocation: () => void;
  onEditTrip: () => void;
  onDeleteTrip: () => void;
  onImportStatement: () => void;
}

export function DesktopShell({
  tripId,
  active,
  children,
  onAddExpense,
  onAddParticipants,
  onAddLocation,
  onEditTrip,
  onDeleteTrip,
  onImportStatement,
}: DesktopShellProps) {
  return (
    <div className="hidden min-100dvh min-vh grid-cols-[260px_1fr] gap-8 px-8 py-10 text-white antialiased lg:grid">
      <aside className="flex flex-col" aria-label="Sidebar">
        <div className="glass h-full p-6">
          <div className="flex items-center justify-between">
            <span className="text-xl font-semibold tracking-tight text-white">TripPay</span>
            <OfflineIndicator />
          </div>
          <nav className="mt-8 flex flex-col gap-3 text-sm">
            <Link
              href={`/trip/${tripId}`}
              className={clsx(
                "glass-sm flex items-center gap-3 rounded-2xl px-4 py-3 text-white/80 transition-all duration-200 hover:text-white",
                active === "expenses" && "text-white shadow-lg ring-1 ring-white/25"
              )}
            >
              <Home className="h-5 w-5" />
              <span className="font-medium">הוצאות</span>
            </Link>
            <Link
              href={`/trip/${tripId}/summary`}
              className={clsx(
                "glass-sm flex items-center gap-3 rounded-2xl px-4 py-3 text-white/80 transition-all duration-200 hover:text-white",
                active === "summary" && "text-white shadow-lg ring-1 ring-white/25"
              )}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="font-medium">סיכום</span>
            </Link>
            <Link
              href={`/trip/${tripId}/search`}
              className={clsx(
                "glass-sm flex items-center gap-3 rounded-2xl px-4 py-3 text-white/80 transition-all duration-200 hover:text-white",
                active === "search" && "text-white shadow-lg ring-1 ring-white/25"
              )}
            >
              <SearchIcon className="h-5 w-5" />
              <span className="font-medium">חיפוש</span>
            </Link>
          </nav>
        </div>
      </aside>
      <div className="flex flex-col gap-6">
        <header className="glass flex items-center justify-between rounded-[28px] px-6 py-4" role="banner">
          <div className="flex items-center gap-3 text-white">
            <span className="text-lg font-semibold tracking-tight">TripPay</span>
            <OfflineIndicator />
          </div>
          <div className="flex items-center gap-2" role="toolbar">
            <button
              onClick={onImportStatement}
              className="glass-sm hidden h-10 rounded-2xl px-3 text-white/80 transition hover:text-white lg:inline-flex"
            >
              ייבוא דוח
            </button>
            <Link
              href={`/trip/${tripId}/search`}
              className="glass-sm flex items-center justify-center rounded-full p-2 text-white/80 transition hover:text-white"
              aria-label="Search"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>
            <AddSplitButton
              onAddExpense={onAddExpense}
              onAddParticipants={onAddParticipants}
              onAddLocation={onAddLocation}
            />
            <TripSettingsDropdown
              tripId={tripId}
              onEdit={onEditTrip}
              onDelete={onDeleteTrip}
            />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto rounded-[28px] p-8 glass" dir="auto">
          {children}
        </main>
      </div>
    </div>
  );
}
