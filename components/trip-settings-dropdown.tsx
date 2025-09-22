"use client"

import { Settings, Copy, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { forgetRecentTrips } from "@/lib/recent-trips"

interface TripSettingsDropdownProps {
  tripId: string
  onEdit: () => void
  onDelete: () => Promise<void> | void
}

export function TripSettingsDropdown({ tripId, onEdit, onDelete }: TripSettingsDropdownProps) {
  const copyTripId = async () => {
    try {
      await navigator.clipboard.writeText(tripId)
      toast.success("Trip ID copied to clipboard")
    } catch (e) {
      console.error(e)
      toast.error("Failed to copy Trip ID")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghostLight"
          size="icon"
          className="rounded-full text-white/80 hover:text-white"
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={copyTripId} className="gap-2">
          <Copy className="h-4 w-4" /> Copy Trip ID
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit} className="gap-2">
          <Pencil className="h-4 w-4" /> Edit Trip
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            forgetRecentTrips()
            toast.success("Cleared recent trips on this device")
          }}
          className="gap-2"
        >
          <span className="h-4 w-4">🧹</span> Forget recent trips on this device
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          variant="destructive"
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" /> Delete Trip
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
