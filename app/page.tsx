"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { supabase, type Trip } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import {
  Plus,
  Users,
  LogOut,
  Calendar,
  Receipt,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"

export default function HomePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const [trips, setTrips] = useState<(Trip & { member_count?: number })[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [tripName, setTripName] = useState("")
  const [tripDescription, setTripDescription] = useState("")
  const [tripCode, setTripCode] = useState("")
  const [loadingTrips, setLoadingTrips] = useState(true)
  const router = useRouter()

  const loadTrips = useCallback(async () => {
    if (!user) return
    try {
      // Fetch trips where user is owner or member
      const { data: memberTrips } = await supabase
        .from("trip_members")
        .select("trip_id")
        .eq("user_id", user.id)

      const tripIds = memberTrips?.map((m: { trip_id: string }) => m.trip_id) || []

      // Also fetch trips created by this user (for backwards compatibility)
      const { data: ownedTrips } = await supabase
        .from("trips")
        .select("*")
        .eq("created_by", user.id)

      const ownedIds = new Set(ownedTrips?.map((t: Trip) => t.id) || [])

      // Fetch member trips not already in owned set
      const memberOnlyIds = tripIds.filter((id: string) => !ownedIds.has(id))

      let memberTripData: Trip[] = []
      if (memberOnlyIds.length > 0) {
        const { data } = await supabase
          .from("trips")
          .select("*")
          .in("id", memberOnlyIds)
        memberTripData = data || []
      }

      const allTrips = [...(ownedTrips || []), ...memberTripData]
      allTrips.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )

      setTrips(allTrips)
    } catch (error) {
      console.error("Error loading trips:", error)
    } finally {
      setLoadingTrips(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadTrips()
    } else if (!authLoading) {
      setLoadingTrips(false)
    }
  }, [user, authLoading, loadTrips])

  const createTrip = async () => {
    if (!tripName.trim() || !user) return

    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from("trips")
        .insert([
          {
            name: tripName.trim(),
            description: tripDescription.trim() || null,
            created_by: user.id,
          },
        ])
        .select()
        .single()

      if (error) throw error

      // Add user as trip owner
      await supabase.from("trip_members").insert({
        trip_id: data.id,
        user_id: user.id,
        role: "owner",
      })

      toast.success("Trip created")
      router.push(`/trip/${data.id}`)
    } catch (error) {
      console.error("Error creating trip:", error)
      toast.error("Failed to create trip")
    } finally {
      setIsCreating(false)
    }
  }

  const joinTrip = async () => {
    if (!tripCode.trim() || !user) return

    setIsJoining(true)
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("id, name")
        .eq("id", tripCode.trim())
        .single()

      if (error || !data) {
        toast.error("Trip not found")
        return
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from("trip_members")
        .select("id")
        .eq("trip_id", data.id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!existing) {
        await supabase.from("trip_members").insert({
          trip_id: data.id,
          user_id: user.id,
          role: "member",
        })
      }

      toast.success(`Joined "${data.name}"`)
      router.push(`/trip/${data.id}`)
    } catch (error) {
      console.error("Error joining trip:", error)
      toast.error("Failed to join trip")
    } finally {
      setIsJoining(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  if (authLoading) {
    return (
      <div className="min-100dvh min-vh app-bg flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || "?"

  return (
    <div className="min-100dvh min-vh app-bg antialiased text-white">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-primary)]/15 border border-[var(--brand-primary)]/25 text-sm font-bold text-[var(--brand-primary)]">
              {userInitial}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">TripPay</h1>
              <p className="text-xs text-white/40">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghostLight"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5 text-white/40 hover:text-white/70"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </header>

        {/* Quick Actions */}
        <div className="mb-8 flex gap-3">
          <Button
            onClick={() => {
              setShowCreateForm(true)
              setShowJoinForm(false)
            }}
            className="flex-1 h-11 rounded-xl font-medium"
          >
            <Plus className="h-4 w-4" />
            Create Trip
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowJoinForm(true)
              setShowCreateForm(false)
            }}
            className="flex-1 h-11 rounded-xl font-medium"
          >
            <Users className="h-4 w-4" />
            Join Trip
          </Button>
        </div>

        {/* Create Trip Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">New Trip</h3>
                <Button
                  variant="ghostLight"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createTrip()
                }}
                className="space-y-3"
              >
                <Input
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="Trip name"
                  className="h-11 rounded-xl"
                  autoFocus
                />
                <Textarea
                  value={tripDescription}
                  onChange={(e) => setTripDescription(e.target.value)}
                  placeholder="Short description (optional)"
                  className="min-h-[80px] rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={isCreating || !tripName.trim()}
                  className="w-full h-11 rounded-xl font-medium"
                >
                  {isCreating ? "Creating..." : "Create Trip"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Join Trip Form */}
        {showJoinForm && (
          <Card className="mb-6">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Join a Trip</h3>
                <Button
                  variant="ghostLight"
                  size="sm"
                  onClick={() => setShowJoinForm(false)}
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  joinTrip()
                }}
                className="space-y-3"
              >
                <Input
                  value={tripCode}
                  onChange={(e) => setTripCode(e.target.value)}
                  placeholder="Paste trip code"
                  dir="ltr"
                  className="h-11 rounded-xl"
                  autoFocus
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isJoining || !tripCode.trim()}
                  className="w-full h-11 rounded-xl font-medium"
                >
                  {isJoining ? "Joining..." : "Join Trip"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Trip List */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
            Your Trips
          </h2>

          {loadingTrips ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass rounded-[var(--radius-xxl)] p-5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl skeleton-shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded skeleton-shimmer" />
                      <div className="h-3 w-20 rounded skeleton-shimmer" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                  <Receipt className="h-6 w-6 text-white/30" />
                </div>
                <p className="text-sm font-medium text-white/60">No trips yet</p>
                <p className="mt-1 text-xs text-white/30">
                  Create a trip or join one with a code
                </p>
              </CardContent>
            </Card>
          ) : (
            trips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => router.push(`/trip/${trip.id}`)}
                className="glass w-full rounded-[var(--radius-xxl)] p-5 text-start transition-all duration-200 hover:border-white/20 hover:shadow-lg active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10">
                    <Calendar className="h-5 w-5 text-[var(--brand-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 dir="auto" className="text-base font-semibold text-white truncate">
                      {trip.name}
                    </h3>
                    {trip.description && (
                      <p dir="auto" className="text-sm text-white/40 truncate">
                        {trip.description}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-end">
                    <p className="text-xs text-white/30">
                      {new Date(trip.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
