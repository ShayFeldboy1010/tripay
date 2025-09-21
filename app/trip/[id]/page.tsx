"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase, type Trip, type Expense } from "@/lib/supabase/client"
import { CalendarRange, LineChart, Receipt, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
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
import { useTheme } from "@/theme/ThemeProvider"

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
  const { colors } = useTheme()
  const amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat("he-IL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  )
  const integerFormatter = useMemo(() => new Intl.NumberFormat("he-IL"), [])

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
      <div className="min-h-screen px-4 py-10 text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-white/80">
        <div className="glass rounded-3xl px-8 py-10 text-center">
          <p className="text-lg font-semibold text-white/90">הטיול לא נמצא</p>
          <p className="mt-2 text-sm text-white/60">נחזיר אתכם למסך הראשי כדי להתחיל מחדש.</p>
          <Button className="mt-6" onClick={() => router.push("/")}>חזרה למסך הבית</Button>
        </div>
      </div>
    )
  }

  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalCount = expenses.length
  const heroAmount = amountFormatter.format(totalAmount)
  const averageExpense = totalCount > 0 ? totalAmount / totalCount : 0
  const averageAmount = amountFormatter.format(averageExpense)
  const activeDays = expenses.length
    ? new Set(expenses.map((expense) => new Date(expense.created_at).toISOString().split("T")[0])).size
    : 0
  const lastExpenseTimestamp = expenses.reduce((latest, expense) => {
    const timestamp = new Date(expense.created_at).getTime()
    return timestamp > latest ? timestamp : latest
  }, 0)
  const lastUpdatedLabel = lastExpenseTimestamp
    ? new Date(lastExpenseTimestamp).toLocaleDateString("he-IL", { day: "numeric", month: "long" })
    : "—"

  const metrics: { label: string; value: string; unit?: string; icon: LucideIcon }[] = [
    {
      label: "הוצאה ממוצעת",
      value: averageAmount,
      unit: "₪",
      icon: LineChart,
    },
    {
      label: "סה\"כ הוצאות",
      value: integerFormatter.format(totalCount),
      icon: Receipt,
    },
    {
      label: "ימים פעילים",
      value: integerFormatter.format(activeDays),
      icon: CalendarRange,
    },
  ]

  const content = (
    <div className="relative mx-auto max-w-[1180px] space-y-8 px-4 pb-36 pt-8 sm:space-y-10 sm:px-6">
      <section className="glass rounded-3xl p-8 sm:p-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 right-[45%] left-0 bg-white/5 mix-blend-overlay opacity-60" />
          <div className="absolute inset-y-0 left-[55%] right-0 bg-white/10 mix-blend-overlay opacity-40" />
        </div>
        <div className="relative flex flex-col gap-8">
          <header className="relative">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95" dir="auto">
              {trip.name}
            </h1>
            <p className="mt-1 text-sm text-white/60" dir="auto">
              {trip.description || "כל ההוצאות והחלוקות של הצוות במקום אחד."}
            </p>
          </header>

          <div className="relative">
            <div className="flex flex-row-reverse items-baseline justify-between gap-4 sm:gap-6">
              <div className="flex items-baseline gap-2 justify-end" dir="ltr">
                <span className="text-6xl sm:text-7xl font-black tracking-tight tabular-nums">{heroAmount}</span>
                <span className="text-3xl font-extrabold text-white/95">₪</span>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/60 text-end">
              {integerFormatter.format(totalCount)} הוצאות בסך הכול · עודכן {lastUpdatedLabel}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <div
                  key={metric.label}
                  className="pill bg-primary-100 flex items-center gap-4 text-white/90 ring-1 ring-white/5 hover:ring-white/10 transition"
                >
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-200 text-white/90">
                    <Icon className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <span className="text-xs text-white/60">{metric.label}</span>
                    <span className="flex items-baseline gap-1 text-sm font-semibold text-white/90" dir={metric.unit ? "ltr" : "rtl"}>
                      <span>{metric.value}</span>
                      {metric.unit ? <span className="text-xs font-semibold">{metric.unit}</span> : null}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {showAddForm && (
        <AddExpenseForm tripId={tripId} onExpenseAdded={onExpenseAdded} onCancel={() => setShowAddForm(false)} />
      )}

      <section className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white/90">ההוצאות האחרונות</h2>
          <p className="text-sm text-white/55">
            מסודר לפי ימים עם סיכום יומי כדי להבין את הדופק של הטיול.
          </p>
        </header>
        <ExpenseList expenses={expenses} onExpenseUpdated={onExpenseUpdated} onExpenseDeleted={onExpenseDeleted} />
      </section>
      {showParticipants && (
        <ManageParticipantsModal tripId={tripId} onClose={() => setShowParticipants(false)} />
      )}
      {showLocations && (
        <ManageLocationsModal tripId={tripId} onClose={() => setShowLocations(false)} />
      )}
      <Dialog.Root open={showEditTrip} onOpenChange={setShowEditTrip}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 w-full outline-none md:left-1/2 md:top-1/2 md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2">
            <Card className="glass rounded-t-3xl border-0 bg-base-800/90 text-white/90 md:rounded-3xl">
              <CardHeader className="flex flex-row items-center justify-between px-4 pb-4 pt-4 text-white/90 md:px-6 md:pt-6">
                <CardTitle className="text-lg font-semibold text-white/95">עריכת פרטי הטיול</CardTitle>
                <Dialog.Close asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 rounded-full text-white/70 hover:bg-white/10 hover:text-white/95"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </Dialog.Close>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-5 text-white/80 md:px-6">
                <div>
                  <label htmlFor="edit-name" className="mb-1 block text-sm font-medium text-white/70">
                    שם הטיול
                  </label>
                  <Input
                    id="edit-name"
                    dir="auto"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-2xl border-white/20 bg-white/5 text-white placeholder:text-white/40 focus-visible:border-primary-400 focus-visible:ring-primary-400/40"
                  />
                </div>
                <div>
                  <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-white/70">
                    תיאור
                  </label>
                  <Textarea
                    id="edit-description"
                    dir="auto"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="rounded-2xl border-white/20 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-primary-400 focus-visible:ring-primary-400/40"
                  />
                </div>
                <Button onClick={saveTrip} disabled={!editName.trim()} className="w-full rounded-2xl font-semibold">
                  שמירה
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
    <div className="min-h-screen bg-gray-50 pb-[env(safe-area-inset-bottom)]">
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
              onEdit={() => setShowEditTrip(true)}
              onDelete={deleteTrip}
            />
          </div>
        </div>
      </header>

      {content}
      {fab}
      <MobileNav tripId={tripId} active="expenses" />
    </div>
  )
}
