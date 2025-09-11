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

export default function TripSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading || !trip) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-30 bg-gray-900 text-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-semibold">TripPay</span>
          <div className="flex items-center gap-2">
            <OfflineIndicator />
            <TripSettingsDropdown
              tripId={tripId}
              onEdit={() => router.push(`/trip/${tripId}`)}
              onDelete={() => router.push("/")}
            />
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 pb-40 pt-4 lg:pb-8">
        <ExpenseReports expenses={expenses} />
      </main>
      <MobileNav tripId={tripId} active="summary" />
    </div>
  );
}

