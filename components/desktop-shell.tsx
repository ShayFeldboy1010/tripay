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
}: DesktopShellProps) {
  return (
    <div className="hidden lg:grid grid-cols-[220px_1fr] min-h-screen">
      <aside className="bg-white border-r p-4" aria-label="Sidebar">
        <nav className="flex flex-col gap-2">
          <Link
            href={`/trip/${tripId}`}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
              active === "expenses" ? "bg-gray-200" : "hover:bg-gray-100"
            )}
          >
            <Home className="h-5 w-5" />
            <span>Expenses</span>
          </Link>
          <Link
            href={`/trip/${tripId}/summary`}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
              active === "summary" ? "bg-gray-200" : "hover:bg-gray-100"
            )}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Summary</span>
          </Link>
          <Link
            href={`/trip/${tripId}/search`}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
              active === "search" ? "bg-gray-200" : "hover:bg-gray-100"
            )}
          >
            <SearchIcon className="h-5 w-5" />
            <span>Search</span>
          </Link>
        </nav>
      </aside>
      <div className="flex flex-col">
        <header className="h-14 flex items-center justify-between border-b bg-white px-6" role="banner">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">TripPay</span>
            <OfflineIndicator />
          </div>
          <div className="flex items-center gap-2" role="toolbar">
            <Link
              href={`/trip/${tripId}/search`}
              className="p-2 rounded hover:bg-gray-100"
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
        <main className="flex-1 overflow-y-auto p-6" dir="auto">{children}</main>
      </div>
    </div>
  );
}
