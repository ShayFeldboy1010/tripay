"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase, type Trip, type Expense } from "@/lib/supabase/client"
import { ExpenseFilters } from "@/components/expense-filters"
import { ExpenseList } from "@/components/expense-list"
import { OfflineIndicator } from "@/components/offline-indicator"
import { TripSettingsDropdown } from "@/components/trip-settings-dropdown"
import { MobileNav } from "@/components/mobile-nav"
import { FAB } from "@/components/fab"
import AddExpenseForm from "@/components/add-expense-form"
import { ManageParticipantsModal } from "@/components/manage-participants-modal"
import { ManageLocationsModal } from "@/components/manage-locations-modal"
import { DesktopShell } from "@/components/desktop-shell"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { offlineStorage } from "@/lib/offline-storage"
import { syncManager } from "@/lib/sync-manager"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { ExpenseCardSkeleton } from "@/components/expense-card-skeleton"

export default function TripSearchPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showLocations, setShowLocations] = useState(false)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    loadTripData()
    setupRealtimeSubscription()
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [tripId])



  const loadTripData = async () => {
    try {
      const offlineTrip = offlineStorage.getTrip(tripId)
      const offlineExpenses = offlineStorage.getExpenses(tripId)
      if (offlineTrip) {
        setTrip(offlineTrip)
        setExpenses(offlineExpenses)
        setFilteredExpenses(offlineExpenses)
      }
      if (navigator.onLine) {
        const { data: tripData } = await supabase.from("trips").select("*").eq("id", tripId).single()
        if (tripData) {
          setTrip(tripData)
          offlineStorage.saveTrip(tripData)
        }
        const { data: expensesData } = await supabase
          .from("expenses")
          .select("*")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: false })
        if (expensesData) {
          setExpenses(expensesData)
          setFilteredExpenses(expensesData)
          expensesData.forEach((e) => offlineStorage.saveExpense(e))
        }
        await syncManager.downloadTripData(tripId)
      }
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    if (!navigator.onLine) return
    const channel = supabase
      .channel(`trip-search-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newExpense = payload.new as Expense
            setExpenses((prev) => [newExpense, ...prev])
            setFilteredExpenses((prev) => [newExpense, ...prev])
            offlineStorage.saveExpense(newExpense)
          } else if (payload.eventType === "UPDATE") {
            const updatedExpense = payload.new as Expense
            setExpenses((prev) => prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e)))
            setFilteredExpenses((prev) => prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e)))
            offlineStorage.saveExpense(updatedExpense)
          } else if (payload.eventType === "DELETE") {
            const deletedExpense = payload.old as Expense
            setExpenses((prev) => prev.filter((e) => e.id !== deletedExpense.id))
            setFilteredExpenses((prev) => prev.filter((e) => e.id !== deletedExpense.id))
            offlineStorage.deleteExpense(deletedExpense.id)
          }
        },
      )
      .subscribe()
    channelRef.current = channel
  }

  const onExpenseUpdated = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setFilteredExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    offlineStorage.saveExpense(updated)
  }

  const onExpenseDeleted = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    setFilteredExpenses((prev) => prev.filter((e) => e.id !== id))
    offlineStorage.deleteExpense(id)
  }

  const onExpenseAdded = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev])
    setFilteredExpenses((prev) => [expense, ...prev])
  }

  if (loading) {
    return (
      <div className="min-h-screen app-bg antialiased text-white">
        <div
          className="space-y-4 px-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)]"
        >
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
        </div>
      </div>
    )
  }

  if (!trip) {
    return <div className="min-h-screen app-bg" />
  }

  const content = (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-40 pt-4 text-white lg:pb-8">
      <ExpenseFilters expenses={expenses} onFiltersChanged={setFilteredExpenses} className="rounded-2xl" />
      <ExpenseList expenses={filteredExpenses} onExpenseUpdated={onExpenseUpdated} onExpenseDeleted={onExpenseDeleted} />
      {showAddForm && (
        <AddExpenseForm tripId={tripId} onExpenseAdded={onExpenseAdded} onCancel={() => setShowAddForm(false)} />
      )}
      {showParticipants && (
        <ManageParticipantsModal tripId={tripId} onClose={() => setShowParticipants(false)} />
      )}
      {showLocations && (
        <ManageLocationsModal tripId={tripId} onClose={() => setShowLocations(false)} />
      )}
    </div>
  )

  const fab = (
    <FAB
      onAddExpense={() => setShowAddForm(true)}
      onAddLocation={() => setShowLocations(true)}
      onAddParticipants={() => setShowParticipants(true)}
    />
  )

  if (isDesktop) {
    return (
      <>
        <DesktopShell
          tripId={tripId}
          active="search"
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
    )
  }

  return (
    <div className="min-h-screen app-bg antialiased text-white">
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
      <MobileNav tripId={tripId} active="search" />
    </div>
  )
}
