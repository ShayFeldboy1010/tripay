"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { syncManager } from "@/lib/sync-manager"
import { offlineStorage } from "@/lib/offline-storage"
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react"

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
      <div className={`flex items-center gap-1 text-xs text-green-600 ${className}`}>
        <Wifi className="h-3 w-3" />
        <span>Online</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
          <WifiOff className="h-3 w-3" />
          Offline
        </Badge>
        {pendingCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {pendingCount} pending
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-800">
        <Wifi className="h-3 w-3" />
        Online
      </Badge>
      {pendingCount > 0 && (
        <>
          <Badge variant="outline" className="flex items-center gap-1 text-orange-600">
            <AlertCircle className="h-3 w-3" />
            {pendingCount} pending
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="h-6 px-2 text-xs">
            {syncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
