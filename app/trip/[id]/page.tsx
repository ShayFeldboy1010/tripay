"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase, type Trip, type Expense, type Participant, type Location } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { X, Share2, Copy, Check } from "lucide-react"
import { ExpenseList } from "@/components/expense-list"
import AddExpenseForm from "@/components/add-expense-form"
import { OfflineIndicator } from "@/components/offline-indicator"
import { MobileNav } from "@/components/mobile-nav"
import { FAB } from "@/components/fab"
import { DesktopShell } from "@/components/desktop-shell"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { offlineStorage } from "@/lib/offline-storage"
import { syncManager } from "@/lib/sync-manager"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { ExpenseCardSkeleton } from "@/components/expense-card-skeleton"
import { ManageParticipantsModal } from "@/components/manage-participants-modal"
import { ManageLocationsModal } from "@/components/manage-locations-modal"
import * as Dialog from "@radix-ui/react-dialog"
import { toast } from "sonner"
import { TripSettingsDropdown } from "@/components/trip-settings-dropdown"
import { useDelayedLoading } from "@/hooks/useDelayedLoading"
import CreditImportDialog from "@/src/features/import/CreditImportDialog"
import { ingestBatch } from "@/src/lib/import/ingest"
import type { NormalizedExpense, SupportedCurrency } from "@/src/types/import"
import { cryptoHash } from "@/src/lib/import/parsers"

export default function TripPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const delayedLoading = useDelayedLoading(loading)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showLocations, setShowLocations] = useState(false)
  const [showEditTrip, setShowEditTrip] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isDesktop = useIsDesktop()

  const loadTripMeta = useCallback(async () => {
    if (!tripId) return
    try {
      if (!navigator.onLine) return
      const [{ data: participantData, error: participantError }, { data: locationData, error: locationError }] =
        await Promise.all([
          supabase.from("participants").select("id, name").eq("trip_id", tripId).order("name"),
          supabase.from("locations").select("id, name").eq("trip_id", tripId).order("name"),
        ])

      if (!participantError) {
        setParticipants(participantData || [])
      }
      if (!locationError) {
        setLocations(locationData || [])
      }
    } catch (error) {
      console.error("Error loading trip metadata:", error)
    }
  }, [tripId])

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
    loadTripMeta()
  }, [loadTripMeta])

  useEffect(() => {
    if (showImportDialog) {
      loadTripMeta()
    }
  }, [showImportDialog, loadTripMeta])

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

      if (navigator.onLine) {
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

        const { data: expensesData, error: expensesError } = await supabase
          .from("expenses")
          .select("*")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: false })

        if (expensesError) {
          console.error("Error loading expenses:", expensesError)
        } else {
          setExpenses(expensesData || [])
          expensesData?.forEach((expense: Expense) => {
            offlineStorage.saveExpense(expense)
          })
        }

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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "INSERT") {
            const newExpense = payload.new as Expense
            setExpenses((prev) => {
              if (prev.some((e) => e.id === newExpense.id)) return prev
              const updated = [newExpense, ...prev]
              offlineStorage.saveExpense(newExpense)
              return updated
            })
          } else if (payload.eventType === "UPDATE") {
            const updatedExpense = payload.new as Expense
            setExpenses((prev) => {
              const updated = prev.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense))
              offlineStorage.saveExpense(updatedExpense)
              return updated
            })
          } else if (payload.eventType === "DELETE") {
            const deletedExpense = payload.old as Expense
            setExpenses((prev) => {
              const updated = prev.filter((expense) => expense.id !== deletedExpense.id)
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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const updatedTrip = payload.new as Trip
          setTrip(updatedTrip)
          offlineStorage.saveTrip(updatedTrip)
        },
      )
      .subscribe()

    channelRef.current = channel
  }

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

  const copyTripCode = async () => {
    try {
      await navigator.clipboard.writeText(tripId)
      setCopied(true)
      toast.success("Trip code copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const onExpenseAdded = (newExpense: Expense) => {
    if (navigator.onLine) {
      setShowAddForm(false)
    } else {
      const updatedExpenses = [newExpense, ...expenses]
      setExpenses(updatedExpenses)
      offlineStorage.saveExpense(newExpense)
      setShowAddForm(false)
    }
  }

  const onExpenseUpdated = (updatedExpense: Expense) => {
    if (!navigator.onLine) {
      const updatedExpenses = expenses.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense))
      setExpenses(updatedExpenses)
      offlineStorage.saveExpense(updatedExpense)
    }
  }

  const onExpenseDeleted = (expenseId: string) => {
    if (!navigator.onLine) {
      const updatedExpenses = expenses.filter((expense) => expense.id !== expenseId)
      setExpenses(updatedExpenses)
      offlineStorage.deleteExpense(expenseId)
    }
  }

  const handleImportExpenses = async (items: NormalizedExpense[]) => {
    if (isImporting) return
    try {
      setIsImporting(true)
      await ingestBatch(items, { tripId, participants, locations })
      toast.success(`הדוח יובא בהצלחה (${items.length})`)
      await loadTripData()
      await loadTripMeta()
    } catch (error) {
      console.error("Error importing credit statement:", error)
      toast.error("ייבוא הדוח נכשל")
      throw error
    } finally {
      setIsImporting(false)
    }
  }

  const participantNameLookup = useMemo(() => {
    const map = new Map<string, string>()
    participants.forEach((participant) => {
      map.set(participant.id, participant.name)
    })
    return map
  }, [participants])

  const existingNormalized = useMemo<NormalizedExpense[]>(() => {
    return expenses.map((expense) => {
      let metadata: unknown = null
      if (expense.note) {
        try {
          metadata = JSON.parse(expense.note)
        } catch {
          metadata = null
        }
      }

      const sourceMeta = (metadata as { source?: Record<string, unknown> } | null)?.source ?? {}
      const provider = typeof sourceMeta.provider === "string" ? sourceMeta.provider : undefined
      const rawLast4 = typeof sourceMeta.cardLast4 === "string" ? sourceMeta.cardLast4 : ""
      const cardLast4 = rawLast4 ? rawLast4.replace(/\D/g, "").slice(-4) : ""
      const fileName = typeof sourceMeta.fileName === "string" ? sourceMeta.fileName : undefined
      const currency = (typeof sourceMeta.currency === "string" && sourceMeta.currency ? sourceMeta.currency : "ILS") as SupportedCurrency
      const storedHash = typeof sourceMeta.hash === "string" && sourceMeta.hash ? sourceMeta.hash : undefined
      const isoDate = expense.date ? new Date(expense.date).toISOString() : new Date(expense.created_at).toISOString()
      const parsedAmount = Number(expense.amount)
      const amount = Number.isNaN(parsedAmount) ? 0 : Math.abs(parsedAmount)
      const description = expense.description || expense.title || ""
      const fallbackHash = cryptoHash(
        JSON.stringify({ date: isoDate, amount, description, currency, last4: cardLast4 }).toLowerCase(),
      )
      const participantNames = Array.isArray(expense.payers)
        ? expense.payers
            .map((id) => participantNameLookup.get(id) || (typeof id === "string" ? id : String(id)))
            .filter((name): name is string => Boolean(name))
        : []

      return {
        date: isoDate,
        amount,
        currency,
        description,
        category: expense.category ?? undefined,
        participants: participantNames,
        source: {
          provider,
          cardLast4: cardLast4 || undefined,
          fileName,
          hash: storedHash ?? fallbackHash,
        },
      }
    })
  }, [expenses, participantNameLookup])

  if (delayedLoading) {
    return (
      <div className="min-100dvh min-vh app-bg antialiased text-white">
        <div className="px-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)] space-y-3">
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-100dvh min-vh app-bg antialiased flex items-center justify-center text-white">
        <div className="space-y-4 text-center">
          <p className="text-base font-medium text-white/60">Trip not found</p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="h-10 rounded-xl px-5"
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-40 pt-4 text-white lg:pb-8">
      {/* Trip header card */}
      <Card className="gap-4 px-5">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h2 dir="auto" className="text-xl md:text-2xl font-semibold text-white">
              {trip.name}
            </h2>
            <p className="text-xs text-white/35">{totalCount} expenses</p>
          </div>
          <div className="text-end">
            <p className="grad-text numeric-display text-3xl font-bold md:text-4xl">₪{totalAmount.toFixed(2)}</p>
          </div>
        </div>
        {/* Share button */}
        <button
          onClick={() => setShowShareDialog(true)}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition w-fit"
        >
          <Share2 className="h-3 w-3" />
          Share trip code
        </button>
      </Card>

      {showAddForm && (
        <AddExpenseForm tripId={tripId} onExpenseAdded={onExpenseAdded} onCancel={() => setShowAddForm(false)} />
      )}

      <ExpenseList expenses={expenses} onExpenseUpdated={onExpenseUpdated} onExpenseDeleted={onExpenseDeleted} />

      {showParticipants && (
        <ManageParticipantsModal
          tripId={tripId}
          onClose={() => setShowParticipants(false)}
          onParticipantsChange={setParticipants}
        />
      )}
      {showLocations && (
        <ManageLocationsModal
          tripId={tripId}
          onClose={() => setShowLocations(false)}
          onLocationsChange={setLocations}
        />
      )}

      {/* Edit Trip Dialog */}
      <Dialog.Root open={showEditTrip} onOpenChange={setShowEditTrip}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay-dim fixed inset-0" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 md:inset-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 z-50 w-full md:max-w-md outline-none">
            <Card className="glass-strong relative z-10 rounded-t-[var(--radius-xxl)] border-none md:rounded-[var(--radius-xxl)]">
              <CardHeader className="flex flex-row items-center justify-between px-5 pb-3 pt-5">
                <CardTitle className="text-base">Edit Trip</CardTitle>
                <Dialog.Close asChild>
                  <Button variant="ghostLight" size="sm" className="h-8 w-8 p-0 rounded-lg">
                    <X className="h-4 w-4" />
                  </Button>
                </Dialog.Close>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5">
                <div>
                  <label htmlFor="edit-name" className="mb-1 block text-xs font-medium text-white/50">
                    Trip Name
                  </label>
                  <Input
                    id="edit-name"
                    dir="auto"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="edit-description" className="mb-1 block text-xs font-medium text-white/50">
                    Description
                  </label>
                  <Textarea
                    id="edit-description"
                    dir="auto"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="rounded-xl"
                  />
                </div>
                <Button
                  onClick={saveTrip}
                  disabled={!editName.trim()}
                  className="w-full h-10 rounded-xl"
                >
                  Save
                </Button>
              </CardContent>
            </Card>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Share Trip Dialog */}
      <Dialog.Root open={showShareDialog} onOpenChange={setShowShareDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay-dim fixed inset-0" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 md:inset-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 z-50 w-full md:max-w-sm outline-none">
            <Card className="glass-strong relative z-10 rounded-t-[var(--radius-xxl)] border-none md:rounded-[var(--radius-xxl)]">
              <CardHeader className="flex flex-row items-center justify-between px-5 pb-3 pt-5">
                <CardTitle className="text-base">Share Trip</CardTitle>
                <Dialog.Close asChild>
                  <Button variant="ghostLight" size="sm" className="h-8 w-8 p-0 rounded-lg">
                    <X className="h-4 w-4" />
                  </Button>
                </Dialog.Close>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5">
                <p className="text-xs text-white/40">Share this code with others so they can join your trip.</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={tripId}
                    readOnly
                    dir="ltr"
                    className="h-10 rounded-xl text-xs font-mono flex-1"
                  />
                  <Button
                    onClick={copyTripCode}
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl flex-shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )

  const importDialog = (
    <CreditImportDialog
      open={showImportDialog}
      onClose={() => setShowImportDialog(false)}
      existing={existingNormalized}
      onImport={handleImportExpenses}
    />
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
          onImportStatement={() => setShowImportDialog(true)}
        >
          {content}
        </DesktopShell>
        {fab}
        {importDialog}
      </>
    )
  }

  return (
    <div className="min-100dvh min-vh app-bg antialiased text-white">
      <div
        className="space-y-4 px-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)]"
      >
        <header className="sticky top-0 z-30">
          <div className="glass flex h-12 items-center justify-between rounded-[var(--radius-xxl)] px-4">
            <span className="text-base font-semibold tracking-tight">TripPay</span>
            <div className="flex items-center gap-1.5 text-white/60">
              <OfflineIndicator />
              <button
                onClick={() => setShowImportDialog(true)}
                className="glass-sm h-8 rounded-xl px-2.5 text-[10px] text-white/50 transition hover:text-white/80"
              >
                ייבוא דוח
              </button>
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
      {importDialog}
    </div>
  )
}
