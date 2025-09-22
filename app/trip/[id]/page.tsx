"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase, type Trip, type Expense } from "@/lib/supabase/client"
import { X } from "lucide-react"
import { ExpenseList } from "@/components/expense-list"
import AddExpenseForm from "@/components/add-expense-form"
import { OfflineIndicator } from "@/components/offline-indicator"
import { MobileNav } from "@/components/mobile-nav"
import { FAB } from "@/components/fab"
import { DesktopShell } from "@/components/desktop-shell"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { offlineStorage } from "@/lib/offline-storage"
import { syncManager } from "@/lib/sync-manager"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { ExpenseCardSkeleton } from "@/components/expense-card-skeleton"
import { ManageParticipantsModal } from "@/components/manage-participants-modal"
import { ManageLocationsModal } from "@/components/manage-locations-modal"
import * as Dialog from "@radix-ui/react-dialog"
import { toast } from "sonner"
import { TripSettingsDropdown } from "@/components/trip-settings-dropdown"
import { useDelayedLoading } from "@/hooks/useDelayedLoading"

export default function TripPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const delayedLoading = useDelayedLoading(loading)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showLocations, setShowLocations] = useState(false)
  const [showEditTrip, setShowEditTrip] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const channelRef = useRef<RealtimeChannel | null>(null)
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

  useEffect(() => {
    if (trip && showEditTrip) {
      setEditName(trip.name)
      setEditDescription(trip.description || "")
    }
  }, [trip, showEditTrip])

  useEffect(() => {
    if (!showEditTrip) {
      setEditName("")
      setEditDescription("")
    }
  }, [showEditTrip])

  const loadTripData = async () => {
    try {
      const offlineTrip = offlineStorage.getTrip(tripId)
      const offlineExpenses = offlineStorage.getExpenses(tripId)

      if (offlineTrip) {
        setTrip(offlineTrip)
        setExpenses(offlineExpenses)
      }

      // If online, fetch fresh data and update offline storage
      if (navigator.onLine) {
        // Load trip details
        const { data: tripData, error: tripError } = await supabase.from("trips").select("*").eq("id", tripId).single()

        if (tripError) {
          if (!offlineTrip) {
            console.error("Trip not found:", tripError)
            alert("Trip not found")
            router.push("/")
            return
          }
        } else {
          setTrip(tripData)
          offlineStorage.saveTrip(tripData)
        }

        // Load expenses
        const { data: expensesData, error: expensesError } = await supabase
          .from("expenses")
          .select("*")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: false })

        if (expensesError) {
          console.error("Error loading expenses:", expensesError)
        } else {
          setExpenses(expensesData || [])

          // Save to offline storage
          expensesData?.forEach((expense) => {
            offlineStorage.saveExpense(expense)
          })
        }

        // Download data for offline use
        await syncManager.downloadTripData(tripId)
      }
    } catch (error) {
      console.error("Error loading trip data:", error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    if (!navigator.onLine) return

    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          console.log("[v0] Real-time expense change:", payload)

          if (payload.eventType === "INSERT") {
            const newExpense = payload.new as Expense
            setExpenses((prev) => {
              // Avoid duplicates if expense was added locally
              if (prev.some((e) => e.id === newExpense.id)) return prev
              const updated = [newExpense, ...prev]
              // Save to offline storage
              offlineStorage.saveExpense(newExpense)
              return updated
            })
          } else if (payload.eventType === "UPDATE") {
            const updatedExpense = payload.new as Expense
            setExpenses((prev) => {
              const updated = prev.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense))
              // Save to offline storage
              offlineStorage.saveExpense(updatedExpense)
              return updated
            })
          } else if (payload.eventType === "DELETE") {
            const deletedExpense = payload.old as Expense
            setExpenses((prev) => {
              const updated = prev.filter((expense) => expense.id !== deletedExpense.id)
              // Remove from offline storage
              offlineStorage.deleteExpense(deletedExpense.id)
              return updated
            })
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          console.log("[v0] Real-time trip change:", payload)
          const updatedTrip = payload.new as Trip
          setTrip(updatedTrip)
          offlineStorage.saveTrip(updatedTrip)
        },
      )
      .subscribe((status) => {
        console.log("[v0] Real-time subscription status:", status)
      })

    channelRef.current = channel
  }

  // Removed filter panel; expenses list always shows all expenses

  const deleteTrip = async () => {
    if (!confirm("Are you sure you want to delete this trip?")) return
    try {
      await supabase.from("trips").delete().eq("id", tripId)
      toast.success("Trip deleted")
      router.push("/")
    } catch (error) {
      console.error("Error deleting trip:", error)
      toast.error("Failed to delete trip")
    }
  }

  const saveTrip = async () => {
    if (!trip) return
    try {
      const { data, error } = await supabase
        .from("trips")
        .update({ name: editName.trim(), description: editDescription.trim() || null })
        .eq("id", tripId)
        .select()
        .single()
      if (error) throw error
      setTrip(data)
      offlineStorage.saveTrip(data)
      toast.success("Trip updated")
      setShowEditTrip(false)
    } catch (error) {
      console.error("Error updating trip:", error)
      toast.error("Failed to update trip")
    }
  }

  const onExpenseAdded = (newExpense: Expense) => {
    if (navigator.onLine) {
      // Real-time subscription will handle the state update
      setShowAddForm(false)
    } else {
      // Add to local state and offline storage immediately
      const updatedExpenses = [newExpense, ...expenses]
      setExpenses(updatedExpenses)
      offlineStorage.saveExpense(newExpense)
      setShowAddForm(false)
    }
  }

  const onExpenseUpdated = (updatedExpense: Expense) => {
    if (navigator.onLine) {
      // Real-time subscription will handle the state update
    } else {
      // Update local state and offline storage immediately
      const updatedExpenses = expenses.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense))
      setExpenses(updatedExpenses)
      offlineStorage.saveExpense(updatedExpense)
    }
  }

  const onExpenseDeleted = (expenseId: string) => {
    if (navigator.onLine) {
      // Real-time subscription will handle the state update
    } else {
      // Remove from local state and offline storage immediately
      const updatedExpenses = expenses.filter((expense) => expense.id !== expenseId)
      setExpenses(updatedExpenses)
      offlineStorage.deleteExpense(expenseId)
    }
  }


  if (delayedLoading) {
    return (
      <div className="min-h-screen app-bg antialiased text-white">
        <div
          className="px-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)] space-y-4"
        >
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen app-bg antialiased flex items-center justify-center text-white">
        <div className="space-y-6 text-center">
          <p className="text-lg font-medium text-white/80">Trip not found</p>
          <Button
            onClick={() => router.push("/")}
            variant="glass"
            className="h-11 rounded-2xl px-5 text-white/90 hover:text-white"
          >
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalCount = expenses.length

  const content = (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-40 pt-4 text-white lg:pb-8">
      <Card className="gap-4 px-5 sm:px-6">
        <div className="space-y-1">
          <h2 dir="auto" className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
            {trip.name}
          </h2>
          <p className="text-sm text-white/70">Have Fun!</p>
        </div>
        <div className="space-y-1 text-end">
          <p className="grad-text text-4xl font-bold leading-tight md:text-5xl">₪{totalAmount.toFixed(2)}</p>
          <p className="text-sm text-white/60">{totalCount} total expenses</p>
        </div>
      </Card>

      {showAddForm && (
        <AddExpenseForm tripId={tripId} onExpenseAdded={onExpenseAdded} onCancel={() => setShowAddForm(false)} />
      )}

      <ExpenseList expenses={expenses} onExpenseUpdated={onExpenseUpdated} onExpenseDeleted={onExpenseDeleted} />
      {showParticipants && (
        <ManageParticipantsModal tripId={tripId} onClose={() => setShowParticipants(false)} />
      )}
      {showLocations && (
        <ManageLocationsModal tripId={tripId} onClose={() => setShowLocations(false)} />
      )}
      <Dialog.Root open={showEditTrip} onOpenChange={setShowEditTrip}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 md:inset-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 z-50 w-full md:max-w-md outline-none">
            <Card className="rounded-t-[28px] border-none shadow-lg md:rounded-[28px]">
              <CardHeader className="flex flex-row items-center justify-between px-4 pb-4 pt-4 md:px-6 md:pt-6">
                <CardTitle>Edit Trip</CardTitle>
                <Dialog.Close asChild>
                  <Button variant="ghostLight" size="sm" className="h-9 w-9 p-0 rounded-full">
                    <X className="h-5 w-5" />
                  </Button>
                </Dialog.Close>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4 md:px-6">
                <div>
                  <label htmlFor="edit-name" className="mb-1 block text-sm font-medium text-white/70">
                    Trip Name
                  </label>
                  <Input
                    id="edit-name"
                    dir="auto"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-11 rounded-2xl border-white/20 bg-white/10 px-4 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                  />
                </div>
                <div>
                  <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-white/70">
                    Description
                  </label>
                  <Textarea
                    id="edit-description"
                    dir="auto"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="rounded-2xl border-white/20 bg-white/10 px-4 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                  />
                </div>
                <Button
                  onClick={saveTrip}
                  disabled={!editName.trim()}
                  variant="glass"
                  className="h-11 w-full rounded-2xl px-4 text-white/90 hover:text-white"
                >
                  Save
                </Button>
              </CardContent>
            </Card>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
          active="expenses"
          onAddExpense={() => setShowAddForm(true)}
          onAddParticipants={() => setShowParticipants(true)}
          onAddLocation={() => setShowLocations(true)}
          onEditTrip={() => setShowEditTrip(true)}
          onDeleteTrip={deleteTrip}
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
                onEdit={() => setShowEditTrip(true)}
                onDelete={deleteTrip}
              />
            </div>
          </div>
        </header>

        {content}
      </div>
      {fab}
      <MobileNav tripId={tripId} active="expenses" />
    </div>
  )
}
