import { supabase } from "@/lib/supabase/client"
import { offlineStorage, type OfflineExpense } from "@/lib/offline-storage"

class SyncManager {
  private syncInProgress = false

  async syncPendingActions(): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress || !navigator.onLine) {
      return { success: 0, failed: 0 }
    }

    this.syncInProgress = true
    const pendingActions = offlineStorage.getPendingActions()
    let success = 0
    let failed = 0

    console.log("[v0] Starting sync of", pendingActions.length, "pending actions")

    for (const action of pendingActions) {
      try {
        let result = false

        switch (action.action) {
          case "create":
            result = await this.syncCreateExpense(action)
            break
          case "update":
            result = await this.syncUpdateExpense(action)
            break
          case "delete":
            result = await this.syncDeleteExpense(action)
            break
        }

        if (result) {
          offlineStorage.removePendingAction(action.offline_id)
          success++
        } else {
          failed++
        }
      } catch (error) {
        console.error("[v0] Sync failed for action:", action, error)
        failed++
      }
    }

    this.syncInProgress = false
    console.log("[v0] Sync completed:", { success, failed })
    return { success, failed }
  }

  private async syncCreateExpense(action: OfflineExpense): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert([
          {
            trip_id: action.trip_id,
            description: action.description,
            amount: action.amount,
            category: action.category,
            paid_by: action.paid_by,
          },
        ])
        .select()
        .single()

      if (error) throw error

      // Update local storage with the real ID
      if (action.id) {
        offlineStorage.deleteExpense(action.id)
      }
      offlineStorage.saveExpense(data)

      return true
    } catch (error) {
      console.error("[v0] Failed to sync create expense:", error)
      return false
    }
  }

  private async syncUpdateExpense(action: OfflineExpense): Promise<boolean> {
    if (!action.id) return false

    try {
      const { data, error } = await supabase
        .from("expenses")
        .update({
          description: action.description,
          amount: action.amount,
          category: action.category,
          paid_by: action.paid_by,
          updated_at: new Date().toISOString(),
        })
        .eq("id", action.id)
        .select()
        .single()

      if (error) throw error

      offlineStorage.saveExpense(data)
      return true
    } catch (error) {
      console.error("[v0] Failed to sync update expense:", error)
      return false
    }
  }

  private async syncDeleteExpense(action: OfflineExpense): Promise<boolean> {
    if (!action.id) return false

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", action.id)

      if (error) throw error

      offlineStorage.deleteExpense(action.id)
      return true
    } catch (error) {
      console.error("[v0] Failed to sync delete expense:", error)
      return false
    }
  }

  async downloadTripData(tripId: string): Promise<void> {
    if (!navigator.onLine) return

    try {
      // Download trip data
      const { data: tripData, error: tripError } = await supabase.from("trips").select("*").eq("id", tripId).single()

      if (tripError) throw tripError
      offlineStorage.saveTrip(tripData)

      // Download expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })

      if (expensesError) throw expensesError

      // Save all expenses
      expensesData?.forEach((expense) => {
        offlineStorage.saveExpense(expense)
      })

      console.log("[v0] Downloaded trip data for offline use")
    } catch (error) {
      console.error("[v0] Failed to download trip data:", error)
    }
  }
}

export const syncManager = new SyncManager()
