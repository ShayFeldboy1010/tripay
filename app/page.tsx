"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase/client"
import {
  addRecentTrip,
  getRecentTrips,
  removeRecentTrip,
  type RecentTrip,
} from "@/lib/recent-trips"
import { Plus, Users } from "lucide-react"
import { toast } from "sonner"

const AUTO_RESUME =
  process.env.NEXT_PUBLIC_AUTO_RESUME_LAST_TRIP === "true"

export default function HomePage() {
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [tripName, setTripName] = useState("")
  const [tripDescription, setTripDescription] = useState("")
  const [tripId, setTripId] = useState("")
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([])
  const router = useRouter()

  useEffect(() => {
    setRecentTrips(getRecentTrips())
  }, [])

  const resumeTrip = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("id, name")
        .eq("id", id)
        .single()

      if (error || !data) {
        removeRecentTrip(id)
        setRecentTrips(getRecentTrips())
        toast.error("Trip not found or access denied")
        return
      }

      router.push(`/trip/${id}`)
    } catch (e) {
      console.error("Error resuming trip:", e)
      toast.error("Failed to open trip")
    }
  }, [router])

  useEffect(() => {
    if (!AUTO_RESUME || recentTrips.length === 0) return

    let interacted = false
    const cancel = () => {
      interacted = true
    }
    window.addEventListener("pointerdown", cancel, { once: true })
    window.addEventListener("keydown", cancel, { once: true })
    const t = setTimeout(() => {
      if (!interacted) resumeTrip(recentTrips[0].id)
    }, 800)
    return () => {
      window.removeEventListener("pointerdown", cancel)
      window.removeEventListener("keydown", cancel)
      clearTimeout(t)
    }
  }, [resumeTrip, recentTrips])

  const createTrip = async () => {
    if (!tripName.trim()) return

    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from("trips")
        .insert([
          {
            name: tripName.trim(),
            description: tripDescription.trim() || null,
          },
        ])
        .select()
        .single()

      if (error) throw error
      addRecentTrip({ id: data.id, name: data.name })
      router.push(`/trip/${data.id}`)
      toast.success("Trip created")
    } catch (error) {
      console.error("Error creating trip:", error)
      toast.error("Failed to create trip")
    } finally {
      setIsCreating(false)
    }
  }

  const joinTrip = async () => {
    if (!tripId.trim()) return

    setIsJoining(true)
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("id, name")
        .eq("id", tripId.trim())
        .single()

      if (error || !data) {
        toast.error("Trip not found")
        return
      }

      addRecentTrip({ id: data.id, name: data.name })
      router.push(`/trip/${data.id}`)
    } catch (error) {
      console.error("Error joining trip:", error)
      toast.error("Failed to join trip")
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-md mx-auto pt-8 md:pt-16 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">TripPay</h1>
          <p className="text-gray-500">Share expenses with friends instantly</p>
        </div>

        {recentTrips.length > 0 && (
          <div className="space-y-4" aria-label="Recent trips">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Trips
            </h2>
            <Button
              onClick={() => resumeTrip(recentTrips[0].id)}
              className="w-full h-12 rounded-2xl bg-blue-600 text-white font-medium hover:bg-blue-500"
              aria-label="Resume last trip"
            >
              Resume last trip
            </Button>
            <div className="flex flex-col gap-2">
              {recentTrips.slice(1, 5).map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  onClick={() => resumeTrip(t.id)}
                  className="h-11 justify-start rounded-xl"
                  aria-label={`Open trip ${t.name ?? t.id}`}
                >
                  {t.name || t.id}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Create Trip Card */}
          <Card className="rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Trip
              </CardTitle>
              <CardDescription className="text-gray-500">Start a new trip and get a shareable Trip ID</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="tripName" className="block text-sm font-medium text-gray-700 mb-1">
                  Trip Name
                </label>
                <Input
                  id="tripName"
                  placeholder="Weekend getaway"
                  value={tripName}
                  dir="auto"
                  onChange={(e) => setTripName(e.target.value)}
                  className="h-12 text-base"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="tripDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <Textarea
                  id="tripDescription"
                  placeholder="Fun weekend with friends"
                  value={tripDescription}
                  dir="auto"
                  onChange={(e) => setTripDescription(e.target.value)}
                  rows={2}
                  className="text-base"
                />
              </div>
              <Button
                onClick={createTrip}
                disabled={!tripName.trim() || isCreating}
                className="w-full h-12 rounded-2xl font-medium hover:shadow"
              >
                {isCreating ? "Creating..." : "Create Trip"}
              </Button>
            </CardContent>
          </Card>

          {/* Join Trip Card */}
          <Card className="rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Join Existing Trip
              </CardTitle>
              <CardDescription className="text-gray-500">Enter a Trip ID shared by a friend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="tripId" className="block text-sm font-medium text-gray-700 mb-1">
                  Trip ID
                </label>
                <Input
                  id="tripId"
                  placeholder="550e8400-e29b-41d4-a716-446655440000"
                  value={tripId}
                  dir="auto"
                  onChange={(e) => setTripId(e.target.value)}
                  className="h-12 text-base"
                  autoComplete="off"
                />
              </div>
              <Button
                onClick={joinTrip}
                disabled={!tripId.trim() || isJoining}
                className="w-full h-12 rounded-2xl font-medium hover:shadow"
              >
                {isJoining ? "Joining..." : "Join Trip"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sample Trip ID for testing */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-2xl text-gray-700 space-y-2">
          <p className="text-sm">
            <strong>For testing:</strong> Use this sample Trip ID:
          </p>
          <code className="text-xs bg-yellow-100 px-2 py-1 rounded font-mono break-all">
            550e8400-e29b-41d4-a716-446655440000
          </code>
        </div>
      </div>
    </div>
  )
}
