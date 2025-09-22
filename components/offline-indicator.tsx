"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { syncManager } from "@/lib/sync-manager"
import { offlineStorage } from "@/lib/offline-storage"
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface OfflineIndicatorProps {
  className?: string
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    // Monitor online status
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener("online", updateOnlineStatus)
    window.addEventListener("offline", updateOnlineStatus)
    updateOnlineStatus()

    // Monitor pending actions
    const updatePendingCount = () => {
      setPendingCount(offlineStorage.getPendingActions().length)
    }

    updatePendingCount()
    const interval = setInterval(updatePendingCount, 1000)

    // Auto-sync when coming online
    const handleOnline = async () => {
      if (navigator.onLine && pendingCount > 0) {
        await handleSync()
      }
    }

    window.addEventListener("online", handleOnline)

    return () => {
      window.removeEventListener("online", updateOnlineStatus)
      window.removeEventListener("offline", updateOnlineStatus)
      window.removeEventListener("online", handleOnline)
      clearInterval(interval)
    }
  }, [pendingCount])

  const handleSync = async () => {
    if (!isOnline || syncing) return

    setSyncing(true)
    try {
      const result = await syncManager.syncPendingActions()
      console.log("[v0] Sync result:", result)

      if (result.success > 0) {
        setPendingCount(offlineStorage.getPendingActions().length)
      }
    } catch (error) {
      console.error("[v0] Sync error:", error)
    } finally {
      setSyncing(false)
    }
  }

  if (isOnline && pendingCount === 0) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-white/70", className)}>
        <Wifi className="h-3 w-3 text-white/70" />
        <span>Online</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-white/80", className)}>
        <span className="glass-sm inline-flex items-center gap-1 rounded-full px-3 py-1 text-white/90">
          <WifiOff className="h-3 w-3" />
          Offline
        </span>
        {pendingCount > 0 && (
          <span className="glass-sm inline-flex items-center gap-1 rounded-full px-3 py-1 text-white/80">
            <AlertCircle className="h-3 w-3" />
            {pendingCount} pending
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2 text-xs text-white/80", className)}>
      <span className="glass-sm inline-flex items-center gap-1 rounded-full px-3 py-1 text-white/90">
        <Wifi className="h-3 w-3" />
        Online
      </span>
      {pendingCount > 0 && (
        <>
          <span className="glass-sm inline-flex items-center gap-1 rounded-full px-3 py-1 text-white/80">
            <AlertCircle className="h-3 w-3" />
            {pendingCount} pending
          </span>
          <Button
            variant="glass"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="h-8 rounded-xl px-3 text-xs text-white/80 hover:text-white"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-3 w-3 me-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 me-1" />
                Sync
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
