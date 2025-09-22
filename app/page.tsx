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
import { ArrowRight, Plus, Users } from "lucide-react"
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

  const topTrip = recentTrips[0]
  const additionalTrips = topTrip ? recentTrips.slice(1, 5) : []

  return (
    <div className="min-h-screen app-bg antialiased">
      <div className="relative min-h-screen overflow-hidden text-white">
        <div
          className="px-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)]"
        >
          <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 md:px-8 md:py-20">
        <header className="max-w-2xl space-y-6">
          <span className="glass-sm inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm font-medium uppercase tracking-[0.35em] text-white/80">
            TripPay
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Plan adventures, split costs, stay in sync
          </h1>
          <p className="text-lg text-white/70 md:text-xl">
            Kick off a brand new journey or jump back into a trip a friend shared — all from one welcoming hub.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="space-y-6" aria-label="Recent trips">
            {topTrip ? (
              <div className="glass rounded-[28px] p-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                    Recent trips
                  </p>
                  <h2 className="text-2xl font-semibold text-white">Pick up where you left off</h2>
                  <p className="text-sm text-white/70">
                    Reopen a recent adventure or explore another journey in seconds.
                  </p>
                </div>
                <div className="mt-6 space-y-5">
                  <Button
                    onClick={() => resumeTrip(topTrip.id)}
                    className="group flex h-auto items-center justify-between rounded-[22px] glass-sm px-5 py-4 text-left text-white/90 transition duration-200 hover:-translate-y-0.5 hover:text-white"
                    aria-label={`Resume trip ${topTrip.name ?? topTrip.id}`}
                  >
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-white/60">Resume</p>
                      <p className="mt-1 text-lg font-semibold leading-tight text-white">
                        {topTrip.name || "Last trip"}
                      </p>
                      <p className="text-xs text-white/60">{topTrip.id}</p>
                    </div>
                    <ArrowRight className="size-5 shrink-0 text-white/60 transition-transform duration-200 group-hover:translate-x-1" />
                  </Button>

                  {additionalTrips.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {additionalTrips.map((t) => (
                        <Button
                          key={t.id}
                          variant="ghost"
                          onClick={() => resumeTrip(t.id)}
                          className="h-auto items-start justify-between rounded-[22px] glass-sm px-4 py-3 text-left text-white transition duration-200 hover:text-white"
                          aria-label={`Open trip ${t.name ?? t.id}`}
                        >
                          <div className="space-y-1 text-white/80">
                            <span className="block text-sm font-semibold leading-tight text-white">
                              {t.name || "Unnamed trip"}
                            </span>
                            <span className="block text-xs text-white/60">{t.id}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass rounded-[28px] border border-dashed border-white/25 p-6 text-white/70">
                <p className="text-lg font-medium text-white">No trips yet</p>
                <p className="mt-2 text-sm text-white/60">
                  Create your first trip to see it appear here for quick access later.
                </p>
              </div>
            )}
          </section>

          <section className="space-y-6" aria-label="Trip actions">
            <Card className="relative overflow-hidden glass text-white">
              <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-white/20 via-white/5 to-transparent" />
              <CardHeader className="relative z-10 pb-0">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl glass-sm">
                    <Plus className="size-5" />
                  </span>
                  Create a trip
                </CardTitle>
                <CardDescription className="relative z-10 text-base text-white/70">
                  Start a new shared wallet and instantly get a Trip ID to send to your friends.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 space-y-5 pb-8 pt-6">
                <div className="space-y-2">
                  <label htmlFor="tripName" className="block text-sm font-medium text-white/70">
                    Trip name
                  </label>
                  <Input
                    id="tripName"
                    placeholder="Weekend getaway"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="h-12 rounded-2xl border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 focus-visible:border-white/50 focus-visible:ring-white/40"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tripDescription" className="block text-sm font-medium text-white/70">
                    Description (optional)
                  </label>
                  <Textarea
                    id="tripDescription"
                    placeholder="Fun weekend with friends"
                    value={tripDescription}
                    onChange={(e) => setTripDescription(e.target.value)}
                    rows={2}
                    className="rounded-2xl border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 focus-visible:border-white/50 focus-visible:ring-white/40"
                  />
                </div>
                <Button
                  onClick={createTrip}
                  disabled={!tripName.trim() || isCreating}
                  variant="glass"
                  className="h-12 w-full rounded-2xl px-4 text-base font-semibold text-white/90 transition hover:-translate-y-0.5 hover:text-white"
                >
                  {isCreating ? "Creating..." : "Create trip"}
                </Button>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden glass text-white">
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),transparent_70%)]" />
              <CardHeader className="relative z-10 pb-0">
                <CardTitle className="flex items-center gap-3 text-2xl text-white">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl glass-sm">
                    <Users className="size-5" />
                  </span>
                  Join a trip
                </CardTitle>
                <CardDescription className="text-base text-white/70">
                  Enter a Trip ID shared by friends to access the shared expenses instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 space-y-5 pb-8 pt-6">
                <div className="space-y-2">
                  <label htmlFor="tripId" className="block text-sm font-medium text-white/70">
                    Trip ID
                  </label>
                  <Input
                    id="tripId"
                    placeholder="550e8400-e29b-41d4-a716-446655440000"
                    value={tripId}
                    onChange={(e) => setTripId(e.target.value)}
                    className="h-12 rounded-2xl border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 focus-visible:border-white/50 focus-visible:ring-white/40"
                    autoComplete="off"
                  />
                </div>
                <Button
                  onClick={joinTrip}
                  disabled={!tripId.trim() || isJoining}
                  variant="glass"
                  className="h-12 w-full rounded-2xl px-4 text-base font-semibold text-white/90 transition hover:-translate-y-0.5 hover:text-white"
                >
                  {isJoining ? "Joining..." : "Join trip"}
                </Button>
                <div className="glass-sm rounded-2xl p-4 text-xs text-white/70">
                  <p className="font-semibold uppercase tracking-[0.35em] text-white/60">
                    Try it out
                  </p>
                  <p className="mt-2 break-all font-mono text-[11px] text-white/80">
                    550e8400-e29b-41d4-a716-446655440000
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
          </main>
        </div>
      </div>
    </div>
  )
}
