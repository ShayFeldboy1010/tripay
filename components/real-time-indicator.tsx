"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Wifi, WifiOff, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface RealtimeIndicatorProps {
  className?: string
}

export function RealtimeIndicator({ className }: RealtimeIndicatorProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [hasActivity, setHasActivity] = useState(false)

  useEffect(() => {
    // Monitor connection status
    const channel = supabase.channel("connection-status").subscribe((status) => {
      setIsConnected(status === "SUBSCRIBED")
    })

    // Show activity indicator briefly when data changes
    const activityChannel = supabase
      .channel("activity-indicator")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        setHasActivity(true)
        setTimeout(() => setHasActivity(false), 1000)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => {
        setHasActivity(true)
        setTimeout(() => setHasActivity(false), 1000)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(activityChannel)
    }
  }, [])

  return (
    <div className={cn("flex items-center gap-1 text-xs text-white/70", className)}>
      {hasActivity ? (
        <>
          <Activity className="h-3 w-3 text-white/80 animate-pulse" />
          <span>Syncing...</span>
        </>
      ) : isConnected ? (
        <>
          <Wifi className="h-3 w-3 text-white/70" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-white/60" />
          <span className="text-white/60">Offline</span>
        </>
      )}
    </div>
  )
}
