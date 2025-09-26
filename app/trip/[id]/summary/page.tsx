"use client"

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, type Trip, type Expense, type Participant } from "@/lib/supabase/client";
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
import { TotalBalance } from "@/components/total-balance";

export default function TripSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [participantsCount, setParticipantsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const isDesktop = useIsDesktop();

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
          const { data: participantsData } = await supabase
            .from("participants")
            .select("id")
            .eq("trip_id", tripId);
          if (participantsData) {
            setParticipantsCount(participantsData.length);
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

  const onParticipantsChange = (updatedParticipants: Participant[]) => {
    setParticipantsCount(updatedParticipants.length);
  };

  if (loading || !trip) {
    return <div className="min-100dvh min-vh app-bg" />;
  }

  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalExpenses = expenses.length;
  const participantSet = new Set<string>();
  expenses.forEach((expense) => {
    expense.payers?.forEach((payer) => participantSet.add(payer));
    if (expense.paid_by && expense.paid_by !== "Both") {
      participantSet.add(expense.paid_by);
    }
  });
  const derivedParticipantCount = participantSet.size;
  const participantCount =
    participantsCount ?? (derivedParticipantCount > 0 ? derivedParticipantCount : 1);
  const averageExpense = totalExpenses > 0 ? totalAmount / totalExpenses : 0;

  const content = (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pb-32 pt-6 text-white lg:pb-12">
      <TotalBalance
        amount={totalAmount}
        totalExpenses={totalExpenses}
        participantCount={participantCount}
        averageExpense={averageExpense}
      />
      <div className="glass rounded-[28px] p-6">
        <ExpenseReports expenses={expenses} />
      </div>
      {showAddForm && (
        <AddExpenseForm tripId={tripId} onExpenseAdded={onExpenseAdded} onCancel={() => setShowAddForm(false)} />
      )}
      {showParticipants && (
        <ManageParticipantsModal
          tripId={tripId}
          onClose={() => setShowParticipants(false)}
          onParticipantsChange={onParticipantsChange}
        />
      )}
      {showLocations && (
        <ManageLocationsModal tripId={tripId} onClose={() => setShowLocations(false)} />
      )}
    </div>
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
    <div className="min-100dvh min-vh app-bg antialiased text-white">
      <div
        className="space-y-6 px-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)]"
      >
        <header className="sticky top-0 z-30">
          <div className="glass flex h-14 items-center justify-between rounded-[28px] px-4">
            <span className="text-lg font-semibold tracking-tight">TripPay</span>
            <div className="flex items-center gap-2 text-white/80">
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
      </div>
      {fab}
      <MobileNav tripId={tripId} active="summary" />
    </div>
  );
}

