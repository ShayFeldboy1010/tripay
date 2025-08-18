"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase, type Trip, type Expense } from "@/lib/supabase/client"
import { ArrowLeft, Share2, Plus, Filter, BarChart3, Settings } from "lucide-react"
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
  const [isConnected, setIsConnected] = useState(true)
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
        setIsConnected(status === "SUBSCRIBED")
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

  const shareTrip = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join "${trip?.name}" trip`,
          text: `Join my trip to track expenses together!`,
          url: window.location.href,
        })
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      alert("Trip link copied to clipboard!")
    }
  }

  const copyTripId = () => {
    navigator.clipboard.writeText(tripId)
    alert("Trip ID copied to clipboard!")
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 space-y-4">
        <ExpenseCardSkeleton />
        <ExpenseCardSkeleton />
        <ExpenseCardSkeleton />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-6 font-medium">Trip not found</p>
          <Button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
          >
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pb-24">
  <div className="max-w-2xl mx-auto p-4 pb-32 md:pb-4">
    {/* Desktop header */}
    <div className="hidden md:flex items-center justify-between mb-8 pt-6">

          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 hover:bg-white/60 rounded-xl px-3 py-2 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Back</span>
          </Button>
          <div className="flex items-center gap-3">
            <OfflineIndicator />
            <Button
              variant="outline"
              onClick={shareTrip}
              className="flex items-center gap-2 bg-white/60 border-white/40 hover:bg-white/80 rounded-xl px-4 py-2 transition-all duration-200"
            >
              <Share2 className="h-4 w-4" />
              <span className="font-medium">Share</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/trip/${tripId}/settings`)}
              className="flex items-center gap-2 bg-white/60 border-white/40 hover:bg-white/80 rounded-xl px-4 py-2 transition-all duration-200"
            >
              <Settings className="h-4 w-4" />
              <span className="font-medium">Settings</span>
            </Button>
          </div>
        </div>

        {/* Mobile header */}
        <div className="flex md:hidden items-center justify-between mb-6 pt-2">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 hover:bg-white/60 rounded-xl px-2 py-2 transition-all duration-200 h-11 min-w-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <OfflineIndicator />
            <Button
              variant="outline"
              onClick={shareTrip}
              className="flex items-center gap-1 bg-white/60 border-white/40 hover:bg-white/80 rounded-xl px-3 py-2 transition-all duration-200 h-11 min-w-[44px]"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="mb-8 bg-white/70 backdrop-blur-sm border-white/40 shadow-lg rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900">{trip.name}</CardTitle>
            {trip.description && <CardDescription className="text-gray-600 mt-1">{trip.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-emerald-600 mb-1">₪{totalAmount.toFixed(2)}</p>
                <p className="text-sm text-gray-600 font-medium">
                  {filteredExpenses.length !== expenses.length
                    ? `${filteredExpenses.length} of ${expenses.length} expenses`
                    : `${expenses.length} total expenses`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyTripId}
                className="text-xs bg-gray-50 hover:bg-gray-100 border-gray-200 rounded-lg px-3 py-2 transition-all duration-200 flex items-center justify-center gap-2"
              >
                Copy Trip ID
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Desktop action buttons */}

        <div className="hidden md:grid grid-cols-2 gap-3 mb-8">
          <Button
            onClick={() => setShowAddForm(true)}
            className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Expense
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 bg-white/60 border-white/40 hover:bg-white/80 rounded-xl py-3 transition-all duration-200 ${showFilters ? "bg-blue-50 border-blue-200 text-blue-700" : ""}`}
          >
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filter</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowReports(!showReports)}
            className={`flex items-center justify-center gap-2 bg-white/60 border-white/40 hover:bg-white/80 rounded-xl py-3 transition-all duration-200 ${showReports ? "bg-blue-50 border-blue-200 text-blue-700" : ""}`}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="font-medium">Reports</span>
          </Button>
        </div>

        {/* Mobile filter toggle */}
        <div className="flex md:hidden items-center justify-end mb-4">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 bg-white/60 border-white/40 hover:bg-white/80 rounded-xl px-4 py-2 transition-all duration-200 h-11 min-w-[44px] ${showFilters ? "bg-blue-50 border-blue-200 text-blue-700" : ""}`}
          >
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filter</span>
          </Button>
        </div>

        {/* Reports */}
        {showReports && (
          <div className="mb-8">
            <ExpenseReports expenses={expenses} />
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="mb-8">
            <ExpenseFilters
              expenses={expenses}
              onFiltersChanged={onFiltersChanged}
              className="bg-white/70 backdrop-blur-sm border-white/40 shadow-lg rounded-2xl"
            />
          </div>
        )}

        {/* Add Expense Form */}
        {showAddForm && (
          <AddExpenseForm tripId={tripId} onExpenseAdded={onExpenseAdded} onCancel={() => setShowAddForm(false)} />
        )}

        {/* Expenses List */}
        <ExpenseList
          expenses={filteredExpenses}
          onExpenseUpdated={onExpenseUpdated}
          onExpenseDeleted={onExpenseDeleted}
        />
      </div>
      <FAB onClick={() => setShowAddForm(true)} />
      <MobileNav tripId={tripId} />
    </div>
  )
}
