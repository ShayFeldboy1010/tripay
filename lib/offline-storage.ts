import type { Trip, Expense } from "@/lib/supabase/client"

export interface OfflineExpense extends Omit<Expense, "id" | "created_at" | "updated_at"> {
  id?: string
  created_at?: string
  updated_at?: string
  offline_id: string
  pending_sync: boolean
  action: "create" | "update" | "delete"
}

export interface OfflineTrip extends Trip {
  pending_sync?: boolean
}

class OfflineStorage {
  private readonly TRIPS_KEY = "offline_trips"
  private readonly EXPENSES_KEY = "offline_expenses"
  private readonly PENDING_ACTIONS_KEY = "pending_actions"

  // Trip storage
  saveTrip(trip: Trip): void {
    const trips = this.getTrips()
    const existingIndex = trips.findIndex((t) => t.id === trip.id)

    if (existingIndex >= 0) {
      trips[existingIndex] = trip
    } else {
      trips.push(trip)
    }

    localStorage.setItem(this.TRIPS_KEY, JSON.stringify(trips))
  }

  getTrip(tripId: string): Trip | null {
    const trips = this.getTrips()
    return trips.find((t) => t.id === tripId) || null
  }

  getTrips(): Trip[] {
    try {
      const stored = localStorage.getItem(this.TRIPS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  // Expense storage
  saveExpense(expense: Expense): void {
    const expenses = this.getExpenses()
    const existingIndex = expenses.findIndex((e) => e.id === expense.id)

    if (existingIndex >= 0) {
      expenses[existingIndex] = expense
    } else {
      expenses.push(expense)
    }

    localStorage.setItem(this.EXPENSES_KEY, JSON.stringify(expenses))
  }

  getExpenses(tripId?: string): Expense[] {
    try {
      const stored = localStorage.getItem(this.EXPENSES_KEY)
      const expenses = stored ? JSON.parse(stored) : []
      return tripId ? expenses.filter((e: Expense) => e.trip_id === tripId) : expenses
    } catch {
      return []
    }
  }

  deleteExpense(expenseId: string): void {
    const expenses = this.getExpenses()
    const filtered = expenses.filter((e) => e.id !== expenseId)
    localStorage.setItem(this.EXPENSES_KEY, JSON.stringify(filtered))
  }

  // Pending actions for sync
  addPendingAction(action: OfflineExpense): void {
    const pending = this.getPendingActions()
    pending.push(action)
    localStorage.setItem(this.PENDING_ACTIONS_KEY, JSON.stringify(pending))
  }

  getPendingActions(): OfflineExpense[] {
    try {
      const stored = localStorage.getItem(this.PENDING_ACTIONS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  removePendingAction(offlineId: string): void {
    const pending = this.getPendingActions()
    const filtered = pending.filter((a) => a.offline_id !== offlineId)
    localStorage.setItem(this.PENDING_ACTIONS_KEY, JSON.stringify(filtered))
  }

  clearPendingActions(): void {
    localStorage.removeItem(this.PENDING_ACTIONS_KEY)
  }

  // Utility methods
  isOnline(): boolean {
    return navigator.onLine
  }

  generateOfflineId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  clear(): void {
    localStorage.removeItem(this.TRIPS_KEY)
    localStorage.removeItem(this.EXPENSES_KEY)
    localStorage.removeItem(this.PENDING_ACTIONS_KEY)
  }
}

export const offlineStorage = new OfflineStorage()
