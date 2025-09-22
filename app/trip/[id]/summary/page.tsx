"use client"

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, type Trip, type Expense } from "@/lib/supabase/client";
import { offlineStorage } from "@/lib/offline-storage";
import { syncManager } from "@/lib/sync-manager";
import { ExpenseReports } from "@/components/expense-reports";
import { OfflineIndicator } from "@/components/offline-indicator";
import { TripSettingsDropdown } from "@/components/trip-settings-dropdown";
import { MobileNav } from "@/components/mobile-nav";
import { FAB } from "@/components/fab";
import AddExpenseForm from "@/components/add-expense-form";
import { ManageParticipantsModal } from "@/components/manage-participants-modal";
import { ManageLocationsModal } from "@/components/manage-locations-modal";
import { DesktopShell } from "@/components/desktop-shell";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useTheme } from "@/theme/ThemeProvider";

export default function TripSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const isDesktop = useIsDesktop();
  const { colors } = useTheme();

  useEffect(() => {
    async function load() {
      try {
        const offlineTrip = offlineStorage.getTrip(tripId);
        const offlineExpenses = offlineStorage.getExpenses(tripId);
        if (offlineTrip) {
          setTrip(offlineTrip);
          setExpenses(offlineExpenses);
        }
        if (navigator.onLine) {
          const { data: tripData } = await supabase
            .from("trips")
            .select("*")
            .eq("id", tripId)
            .single();
          if (tripData) {
            setTrip(tripData);
            offlineStorage.saveTrip(tripData);
          }
          const { data: expensesData } = await supabase
            .from("expenses")
            .select("*")
            .eq("trip_id", tripId)
            .order("created_at", { ascending: false });
          if (expensesData) {
            setExpenses(expensesData);
            expensesData.forEach((e) => offlineStorage.saveExpense(e));
          }
          await syncManager.downloadTripData(tripId);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tripId]);

  const onExpenseAdded = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  if (loading || !trip) {
    return <div className="min-h-screen" />;
  }

  const content = (
    <main className="max-w-3xl mx-auto space-y-6 px-4 pb-40 pt-6 lg:pb-8">
      <ExpenseReports expenses={expenses} />
      {showAddForm && (
        <AddExpenseForm tripId={tripId} onExpenseAdded={onExpenseAdded} onCancel={() => setShowAddForm(false)} />
      )}
      {showParticipants && (
        <ManageParticipantsModal tripId={tripId} onClose={() => setShowParticipants(false)} />
      )}
      {showLocations && (
        <ManageLocationsModal tripId={tripId} onClose={() => setShowLocations(false)} />
      )}
    </main>
  );

  const fab = (
    <FAB
      onAddExpense={() => setShowAddForm(true)}
      onAddLocation={() => setShowLocations(true)}
      onAddParticipants={() => setShowParticipants(true)}
    />
  );

  if (isDesktop) {
    return (
      <>
        <DesktopShell
          tripId={tripId}
          active="summary"
          onAddExpense={() => setShowAddForm(true)}
          onAddParticipants={() => setShowParticipants(true)}
          onAddLocation={() => setShowLocations(true)}
          onEditTrip={() => router.push(`/trip/${tripId}`)}
          onDeleteTrip={() => router.push("/")}
        >
          {content}
        </DesktopShell>
        {fab}
      </>
    );
  }

  return (
    <div
      className="relative min-h-screen pb-[env(safe-area-inset-bottom)]"
      style={{ color: colors.text }}
    >
      <header
        className="sticky top-0 z-30 shadow-sm"
        style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-semibold" style={{ color: colors.onPrimary }}>
            TripPay
          </span>
          <div className="flex items-center gap-2" style={{ color: colors.onPrimary }}>
            <OfflineIndicator />
            <TripSettingsDropdown
              tripId={tripId}
              onEdit={() => router.push(`/trip/${tripId}`)}
              onDelete={() => router.push("/")}
            />
          </div>
        </div>
      </header>

      {content}
      {fab}
      <MobileNav tripId={tripId} active="summary" />
    </div>
  );
}

