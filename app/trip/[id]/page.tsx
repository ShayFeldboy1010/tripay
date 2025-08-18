"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase, type Trip, type Expense } from "@/lib/supabase/client"
import { Plus, Filter, BarChart3, X, Users, MapPin } from "lucide-react"
import { ExpenseList } from "@/components/expense-list"
import AddExpenseForm from "@/components/add-expense-form"
import { ExpenseReports } from "@/components/expense-reports"
import { ExpenseFilters } from "@/components/expense-filters"
import { OfflineIndicator } from "@/components/offline-indicator"
import { MobileNav } from "@/components/mobile-nav"
import { FAB } from "@/components/fab"
import { offlineStorage } from "@/lib/offline-storage"
import { syncManager } from "@/lib/sync-manager"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { ExpenseCardSkeleton } from "@/components/expense-card-skeleton"
import { ManageParticipantsModal } from "@/components/manage-participants-modal"
import { ManageLocationsModal } from "@/components/manage-locations-modal"
import * as Dialog from "@radix-ui/react-dialog"
import { toast } from "sonner"
import { TripSettingsDropdown } from "@/components/trip-settings-dropdown"

export default function TripPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showLocations, setShowLocations] = useState(false)
  const [showEditTrip, setShowEditTrip] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    loadTripData()
    setupRealtimeSubscription()

    // Listen for reports toggle from mobile nav
    const handleToggleReports = () => setShowReports(!showReports)
    const handleShowExpenses = () => {
      setShowFilters(false)
      setShowReports(false)
    }
    window.addEventListener('toggleReports', handleToggleReports)
    window.addEventListener('showExpenses', handleShowExpenses)

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      window.removeEventListener('toggleReports', handleToggleReports)
      window.removeEventListener('showExpenses', handleShowExpenses)
    }
  }, [tripId, showReports])

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
        setFilteredExpenses(offlineExpenses)
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
          setFilteredExpenses(expensesData || [])

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

  useEffect(() => {
    // Re-apply filters when expenses change from real-time updates
    if (showFilters) {
      // Let the filter component handle this
      return
    }
    setFilteredExpenses(expenses)
  }, [expenses, showFilters])

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
      setFilteredExpenses(updatedExpenses)
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
      setFilteredExpenses(updatedExpenses)
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
      setFilteredExpenses(updatedExpenses)
      offlineStorage.deleteExpense(expenseId)
    }
  }

  const onFiltersChanged = (filtered: Expense[]) => {
    setFilteredExpenses(filtered)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 space-y-4">
        <ExpenseCardSkeleton />
        <ExpenseCardSkeleton />
        <ExpenseCardSkeleton />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-6 font-medium">Trip not found</p>
          <Button
            onClick={() => router.push("/")}
            className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-xl shadow-sm transition-all"
          >
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <header className="bg-gray-900 text-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-semibold">TripPay</span>
          <div className="flex items-center gap-2">
            <OfflineIndicator />
            <TripSettingsDropdown
              tripId={tripId}
              onEdit={() => setShowEditTrip(true)}
              onDelete={deleteTrip}
            />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 pb-32 md:pb-8 space-y-6">
        <Card className="rounded-2xl shadow-md">
          <CardHeader className="pb-4">
            <CardTitle dir="auto" className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              {trip.name}
            </CardTitle>
            {trip.description && (
              <CardDescription dir="auto" className="text-gray-500 mt-1">
                {trip.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="text-end space-y-1">
            <p className="text-4xl font-bold text-green-600">₪{totalAmount.toFixed(2)}</p>
            <p className="text-sm text-gray-500">
              {filteredExpenses.length !== expenses.length
                ? `${filteredExpenses.length} of ${expenses.length} expenses`
                : `${expenses.length} total expenses`}
            </p>
          </CardContent>
        </Card>

        <Button
          onClick={() => setShowAddForm(true)}
          className="w-full h-12 rounded-2xl bg-gray-900 text-white font-medium hover:bg-gray-800 hover:shadow"
        >
          <Plus className="h-5 w-5 mr-2" /> Add Expense
        </Button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-2xl border-gray-200 text-gray-900 bg-white hover:bg-gray-50 hover:shadow"
            onClick={() => setShowParticipants(true)}
          >
            <Users className="h-4 w-4 mr-2" /> Add Participants
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl border-gray-200 text-gray-900 bg-white hover:bg-gray-50 hover:shadow"
            onClick={() => setShowLocations(true)}
          >
            <MapPin className="h-4 w-4 mr-2" /> Add Locations
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="ghost"
            className={`h-11 rounded-2xl justify-center border border-gray-200 bg-white hover:bg-gray-50 hover:shadow ${showFilters ? "bg-gray-50" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button
            variant="ghost"
            className={`h-11 rounded-2xl justify-center border border-gray-200 bg-white hover:bg-gray-50 hover:shadow ${showReports ? "bg-gray-50" : ""}`}
            onClick={() => setShowReports(!showReports)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
        </div>

        {showReports && (
          <div className="mb-8">
            <ExpenseReports expenses={expenses} />
          </div>
        )}

        {showFilters && (
          <div className="mb-8">
            <ExpenseFilters
              expenses={expenses}
              onFiltersChanged={onFiltersChanged}
              className="rounded-2xl"
            />
          </div>
        )}

        {showAddForm && (
          <AddExpenseForm tripId={tripId} onExpenseAdded={onExpenseAdded} onCancel={() => setShowAddForm(false)} />
        )}

        <ExpenseList
          expenses={filteredExpenses}
          onExpenseUpdated={onExpenseUpdated}
          onExpenseDeleted={onExpenseDeleted}
        />
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
              <Card className="rounded-t-2xl md:rounded-2xl border-0 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-4 px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle>Edit Trip</CardTitle>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full hover:bg-gray-100">
                      <X className="h-5 w-5" />
                    </Button>
                  </Dialog.Close>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 space-y-4">
                  <div>
                    <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Trip Name
                    </label>
                    <Input
                      id="edit-name"
                      dir="auto"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <Textarea
                      id="edit-description"
                      dir="auto"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button onClick={saveTrip} disabled={!editName.trim()} className="w-full">
                    Save
                  </Button>
                </CardContent>
              </Card>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <FAB onClick={() => setShowAddForm(true)} />
      <MobileNav tripId={tripId} />
    </div>
  )
}
