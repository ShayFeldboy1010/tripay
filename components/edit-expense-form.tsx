"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase, type Expense, type Location, type Participant, EXPENSE_CATEGORIES } from "@/lib/supabase/client"
import { updateExpense } from "@/lib/expenses"
import { offlineStorage } from "@/lib/offline-storage"
import { X } from "lucide-react"
import { clampToDateString } from "@/lib/date"

interface EditExpenseFormProps {
  expense: Expense
  onExpenseUpdated: (expense: Expense) => void
  onCancel: () => void
}

export function EditExpenseForm({ expense, onExpenseUpdated, onCancel }: EditExpenseFormProps) {
  const [title, setTitle] = useState(expense.title || "")
  const [date, setDate] = useState(
    expense.date ? expense.date.split("T")[0] : new Date().toISOString().split("T")[0],
  )
  const [amount, setAmount] = useState(expense.amount.toString())
  const [category, setCategory] = useState<string>(expense.category || "")
  const [locationId, setLocationId] = useState(expense.location_id || "")
  const [selectedPayers, setSelectedPayers] = useState<string[]>(expense.payers || [])
  const [description, setDescription] = useState(expense.description || "")
  const [isSharedPayment, setIsSharedPayment] = useState<boolean>(!!expense.is_shared_payment)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([])
  const [availableLocations, setAvailableLocations] = useState<Location[]>([])

  useEffect(() => {
    loadParticipants()
    loadLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense.trip_id])

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase.from("participants").select("*").eq("trip_id", expense.trip_id)
      if (data && !error) {
        setAvailableParticipants(data)
      }
    } catch (err) {
      console.error("Error loading participants:", err)
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase.from("locations").select("*").eq("trip_id", expense.trip_id)
      if (data && !error) {
        setAvailableLocations(data)
      }
    } catch (err) {
      console.error("Error loading locations:", err)
    }
  }

  const handlePayerToggle = (payerId: string) => {
    setSelectedPayers((prev) =>
      prev.includes(payerId) ? prev.filter((id) => id !== payerId) : [...prev, payerId],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !date || !amount.trim() || !category || !locationId || selectedPayers.length === 0) {
      alert("Please fill in all required fields (title, date, amount, category, location, and at least one payer)")
      return
    }

    const amountNum = Number.parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount")
      return
    }

    setIsSubmitting(true)
    try {
      const selectedPayerNames = availableParticipants
        .filter((p) => selectedPayers.includes(p.id))
        .map((p) => p.name)
      const selectedLocation = availableLocations.find((l) => l.id === locationId)
      const locationName = selectedLocation?.name || ""

      const updateData = {
        title: title.trim(),
        date: clampToDateString(date),
        amount: amountNum,
        category: category as Expense["category"],
        location_id: locationId,
        location: locationName,
        payers: selectedPayers,
        paid_by: selectedPayerNames.length === 1 ? selectedPayerNames[0] : "Multiple",
        description: description.trim() || "",
        is_shared_payment: isSharedPayment,
        updated_at: new Date().toISOString(),
      }

      if (navigator.onLine) {
        const data = await updateExpense(expense.id, updateData)
        onExpenseUpdated(data)
      } else {
        const offlineExpense: Expense = { ...expense, ...updateData }
        offlineStorage.addPendingAction({
          ...offlineExpense,
          offline_id: expense.id,
          pending_sync: true,
          action: "update",
        })
        offlineStorage.saveExpense(offlineExpense)
        onExpenseUpdated(offlineExpense)
      }
    } catch (err: any) {
      console.error("Error updating expense:", err)
      alert(`Failed to update expense: ${err.message || "Unknown error"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="overlay-dim absolute inset-0" />
      <div className="relative flex h-full w-full items-end justify-center p-0 md:items-center md:p-4">
        <Card className="glass-strong relative z-10 flex h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border-none py-0 md:rounded-[28px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="h-1 w-8 rounded-full bg-white/30 md:hidden" />
            <CardTitle className="text-lg font-semibold text-white md:text-xl">Edit Expense</CardTitle>
          </div>
          <Button
            variant="ghostLight"
            size="sm"
            onClick={onCancel}
            className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-full p-0 text-white/70 hover:text-white md:h-8 md:w-8 md:min-h-0 md:min-w-0"
          >
            <X className="h-5 w-5 md:h-4 md:w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-6 pb-0">
          <form id="edit-expense-form" onSubmit={handleSubmit} className="space-y-5 pb-4">
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-white/70">
                Title *
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 rounded-2xl border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30 md:h-11 md:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="date" className="mb-2 block text-sm font-medium text-white/70">
                Date *
              </label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 rounded-2xl border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30 md:h-11 md:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="amount" className="mb-2 block text-sm font-medium text-white/70">
                Amount (₪) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">₪</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 rounded-2xl border-white/20 bg-white/10 pl-8 pr-4 text-end text-base text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30 md:h-11 md:text-sm"
                  inputMode="decimal"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="category" className="mb-2 block text-sm font-medium text-white/70">
                Category *
              </label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger className="h-12 rounded-2xl border-white/20 bg-white/10 px-4 text-base text-white focus-visible:border-white/40 focus-visible:ring-white/30 md:h-11 md:text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="glass-sm border-none text-white">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="rounded-lg text-white">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="location" className="mb-2 block text-sm font-medium text-white/70">
                Location *
              </label>
              <Select value={locationId} onValueChange={setLocationId} required>
                <SelectTrigger className="h-12 rounded-2xl border-white/20 bg-white/10 px-4 text-base text-white focus-visible:border-white/40 focus-visible:ring-white/30 md:h-11 md:text-sm">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent className="glass-sm border-none text-white">
                  {availableLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id} className="rounded-lg text-white">
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">Payers * (select one or more)</label>
              <div className="space-y-3 rounded-2xl border border-white/20 bg-white/5 p-4">
                {availableParticipants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={participant.id}
                      checked={selectedPayers.includes(participant.id)}
                      onCheckedChange={() => handlePayerToggle(participant.id)}
                      className="h-5 w-5"
                    />
                    <label htmlFor={participant.id} className="flex-1 py-2 text-base text-white md:text-sm">
                      {participant.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="shared-payment"
                checked={isSharedPayment}
                onCheckedChange={(checked) => setIsSharedPayment(!!checked)}
                className="h-5 w-5"
              />
              <label
                htmlFor="shared-payment"
                className="cursor-pointer text-base text-white md:text-sm"
              >
                Shared Payment (no balance impact)
              </label>
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-white/70">
                Description (optional)
              </label>
              <Textarea
                id="description"
                placeholder="Additional details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="rounded-2xl border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30 md:text-sm"
              />
            </div>
          </form>
        </CardContent>

        <div
          className="glass-sm flex-shrink-0 p-4 md:p-6"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3">
            <Button
              type="submit"
              form="edit-expense-form"
              disabled={
                isSubmitting ||
                !title.trim() ||
                !date ||
                !amount.trim() ||
                !category ||
                !locationId ||
                selectedPayers.length === 0
              }
              variant="glass"
              className="flex-1 h-12 rounded-2xl px-4 text-base font-semibold text-white/90 transition hover:-translate-y-0.5 hover:text-white md:h-11 md:text-sm"
              onClick={handleSubmit}
            >
              {isSubmitting ? "Updating..." : "Update Expense"}
            </Button>
            <Button
              type="button"
              variant="ghostLight"
              onClick={onCancel}
              className="h-12 rounded-2xl px-6 text-base text-white/70 transition hover:text-white md:h-11 md:text-sm"
            >
              Cancel
            </Button>
          </div>
        </div>
        </Card>
      </div>
    </div>
  )
}

