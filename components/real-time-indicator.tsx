"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Wifi, WifiOff, Activity } from "lucide-react"

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
    <div className={`flex items-center gap-1 text-xs ${className}`}>
      {hasActivity ? (
        <>
          <Activity className="h-3 w-3 text-blue-500 animate-pulse" />
          <span className="text-blue-600">Syncing...</span>
        </>
      ) : isConnected ? (
        <>
          <Wifi className="h-3 w-3 text-green-500" />
          <span className="text-green-600">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-red-500" />
          <span className="text-red-600">Offline</span>
        </>
      )}
    </div>
  )
}
