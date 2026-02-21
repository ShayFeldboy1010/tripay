"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Home, BarChart3, Search as SearchIcon, LogOut } from "lucide-react";
import clsx from "clsx";
import { OfflineIndicator } from "@/components/offline-indicator";
import { TripSettingsDropdown } from "@/components/trip-settings-dropdown";
import { AddSplitButton } from "@/components/add-split-button";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";

interface DesktopShellProps {
  tripId: string;
  active: "expenses" | "summary" | "search";
  children: ReactNode;
  onAddExpense: () => void;
  onAddParticipants: () => void;
  onAddLocation: () => void;
  onEditTrip: () => void;
  onDeleteTrip: () => void;
  onImportStatement?: () => void;
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
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const userInitial = user?.email?.[0]?.toUpperCase() || "?";

  const navLinks = [
    { href: `/trip/${tripId}`, key: "expenses" as const, icon: Home, label: "הוצאות" },
    { href: `/trip/${tripId}/summary`, key: "summary" as const, icon: BarChart3, label: "סיכום" },
    { href: `/trip/${tripId}/search`, key: "search" as const, icon: SearchIcon, label: "חיפוש" },
  ];

  return (
    <div className="hidden min-100dvh min-vh grid-cols-[240px_1fr] gap-6 px-6 py-6 text-white antialiased lg:grid">
      {/* Sidebar */}
      <aside className="flex flex-col" aria-label="Sidebar">
        <div className="glass flex h-full flex-col p-5">
          {/* User info */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-primary)]/15 text-xs font-bold text-[var(--brand-primary)]">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">TripPay</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex flex-col gap-1.5 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/60 transition-all duration-200 hover:bg-white/5 hover:text-white/90",
                  active === link.key && "bg-white/8 text-white font-medium"
                )}
              >
                <link.icon className="h-4 w-4" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* Bottom */}
          <div className="mt-auto pt-4 border-t border-white/8">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/40 transition hover:bg-white/5 hover:text-white/60"
            >
              <Home className="h-4 w-4" />
              <span>All Trips</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/40 transition hover:bg-white/5 hover:text-white/60"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col gap-4">
        {/* Header */}
        <header className="glass flex items-center justify-between rounded-[var(--radius-xxl)] px-5 py-3" role="banner">
          <div className="flex items-center gap-3 text-white">
            <OfflineIndicator />
          </div>
          <div className="flex items-center gap-2" role="toolbar">
            {onImportStatement && (
              <button
                onClick={onImportStatement}
                className="glass-sm h-9 rounded-xl px-3 text-xs text-white/60 transition hover:text-white/90"
              >
                ייבוא דוח
              </button>
            )}
            <Link
              href={`/trip/${tripId}/search`}
              className="glass-sm flex items-center justify-center rounded-xl p-2 text-white/60 transition hover:text-white/90"
              aria-label="Search"
            >
              <SearchIcon className="h-4 w-4" />
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

        {/* Content */}
        <main className="flex-1 overflow-y-auto rounded-[var(--radius-xxl)] p-6 glass" dir="auto">
          {children}
        </main>
      </div>
    </div>
  );
}
