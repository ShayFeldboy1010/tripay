"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase, type Expense, type Location, type Participant, EXPENSE_CATEGORIES } from "@/lib/supabase/client"
import { offlineStorage } from "@/lib/offline-storage"
import { X } from "lucide-react"

interface AddExpenseFormProps {
  tripId: string
  onExpenseAdded: (expense: Expense) => void
  onCancel: () => void
}

export function AddExpenseForm({ tripId, onExpenseAdded, onCancel }: AddExpenseFormProps) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<string>("")
  const [locationId, setLocationId] = useState("")
  const [selectedPayers, setSelectedPayers] = useState<string[]>([])
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([])
  const [availableLocations, setAvailableLocations] = useState<Location[]>([])

  useEffect(() => {
    loadParticipants()
    loadLocations()
  }, [tripId])

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase.from("participants").select("*").eq("trip_id", tripId)
      if (data && !error) {
        setAvailableParticipants(data)
      }
    } catch (error) {
      console.error("Error loading participants:", error)
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase.from("locations").select("*").eq("trip_id", tripId)
      if (data && !error) {
        setAvailableLocations(data)
      }
    } catch (error) {
      console.error("Error loading locations:", error)
    }
  }

  const handlePayerToggle = (payerId: string) => {
    setSelectedPayers((prev) => (prev.includes(payerId) ? prev.filter((id) => id !== payerId) : [...prev, payerId]))
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
      const selectedPayerNames = availableParticipants.filter((p) => selectedPayers.includes(p.id)).map((p) => p.name)
      const selectedLocation = availableLocations.find((l) => l.id === locationId)
      const locationName = selectedLocation?.name || ""

      const expenseData = {
        trip_id: tripId,
        title: title.trim(),
        date,
        amount: amountNum,
        category: category as Expense["category"],
        location_id: locationId,
        location: locationName, // Set legacy location field to satisfy not-null constraint
        payers: selectedPayers,
        paid_by: selectedPayerNames.length === 1 ? selectedPayerNames[0] : "Multiple", // Set paid_by for database constraint
        description: description.trim() || "",
      }

      if (navigator.onLine) {
        const { data, error } = await supabase.from("expenses").insert([expenseData]).select().single()

        if (error) throw error

        onExpenseAdded(data)
      } else {
        const offlineId = offlineStorage.generateOfflineId()
        const offlineExpense: Expense = {
          id: offlineId,
          ...expenseData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        offlineStorage.addPendingAction({
          ...expenseData,
          offline_id: offlineId,
          pending_sync: true,
          action: "create",
        })

        onExpenseAdded(offlineExpense)
      }

      setTitle("")
      setDate(new Date().toISOString().split("T")[0])
      setAmount("")
      setCategory("")
      setLocationId("")
      setSelectedPayers([])
      setDescription("")
    } catch (error) {
      console.error("Error adding expense:", error)
      alert("Failed to add expense. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-white shadow-2xl border-0 rounded-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-6 pt-6">
          <CardTitle className="text-xl font-semibold text-gray-900">Add New Expense</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </Button>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-900 mb-2">
                Title *
              </label>
              <Input
                id="title"
                placeholder="Dinner at restaurant"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-900 mb-2">
                Date *
              </label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-900 mb-2">
                Amount (₪) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">₪</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="25.50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 h-11 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-900 mb-2">
                Category *
              </label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger className="h-11 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="rounded-lg">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-900 mb-2">
                Location *
              </label>
              <Select value={locationId} onValueChange={setLocationId} required>
                <SelectTrigger className="h-11 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                  {availableLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id} className="rounded-lg">
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Payers * (select one or more)</label>
              <div className="space-y-2 p-3 border border-gray-200 rounded-xl">
                {availableParticipants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={participant.id}
                      checked={selectedPayers.includes(participant.id)}
                      onCheckedChange={() => handlePayerToggle(participant.id)}
                    />
                    <label htmlFor={participant.id} className="text-sm text-gray-700 cursor-pointer">
                      {participant.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
                Description (optional)
              </label>
              <Textarea
                id="description"
                placeholder="Additional details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                {isSubmitting ? "Adding..." : "Add Expense"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="h-11 px-6 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-200 bg-transparent"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
