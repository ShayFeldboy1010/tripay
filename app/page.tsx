"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  const tripNameInputRef = useRef<HTMLInputElement | null>(null)
  const tripIdInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setRecentTrips(getRecentTrips())
  }, [])

  const resumeTrip = useCallback(
    async (id: string) => {
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
    },
    [router],
  )

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

  const focusCreateInput = (
    event?: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event) {
      const target = event.target as HTMLElement
      if (target.closest("button, input, textarea")) {
        return
      }
    }
    const node = tripNameInputRef.current
    if (!node) return
    node.focus({ preventScroll: true })
    node.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const focusJoinInput = (
    event?: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event) {
      const target = event.target as HTMLElement
      if (target.closest("button, input, textarea")) {
        return
      }
    }
    const node = tripIdInputRef.current
    if (!node) return
    node.focus({ preventScroll: true })
    node.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const topTrip = recentTrips[0]
  const additionalTrips = topTrip ? recentTrips.slice(1, 5) : []

  return (
    <div className="min-100dvh min-vh app-bg antialiased">
      <div className="relative min-100dvh min-vh overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-[-20%] h-[480px] w-[480px] rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -right-16 bottom-[-10%] h-[380px] w-[380px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>
        <div className="px-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)]">
          <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-4xl flex-col items-center justify-center gap-12 px-4 py-12 text-center md:px-10">
            <header className="space-y-5">
              <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-1 text-sm font-medium text-white/80">
                TripPay
              </span>
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
                TripPay
              </h1>
              <p className="text-pretty text-lg text-white/70 md:text-xl">
                Let&apos;s get lost — but track every expense!
              </p>
            </header>

            <section className="grid w-full gap-6 md:grid-cols-3">
              <Card
                role={topTrip ? "button" : undefined}
                tabIndex={topTrip ? 0 : -1}
                onClick={() => {
                  if (topTrip) {
                    resumeTrip(topTrip.id)
                  }
                }}
                onKeyDown={(event) => {
                  if (!topTrip) return
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    resumeTrip(topTrip.id)
                  }
                }}
                className="group cursor-pointer bg-white/5 transition hover:-translate-y-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                <CardHeader className="items-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white/80 transition group-hover:bg-white/15 group-hover:text-white">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-white">
                    My Trips
                  </CardTitle>
                  <CardDescription className="text-white/70">
                    Open a recent adventure in seconds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                  {topTrip ? (
                    <>
                      <Button
                        variant="glass"
                        className="w-full justify-center rounded-2xl font-semibold text-white/90 transition hover:-translate-y-0.5 hover:text-white"
                        onClick={(event) => {
                          event.stopPropagation()
                          resumeTrip(topTrip.id)
                        }}
                      >
                        Resume {topTrip.name}
                      </Button>
                      {additionalTrips.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-white/70">
                          {additionalTrips.map((trip) => (
                            <button
                              key={trip.id}
                              className="rounded-full bg-white/10 px-3 py-1 transition hover:bg-white/20"
                              onClick={(event) => {
                                event.stopPropagation()
                                resumeTrip(trip.id)
                              }}
                            >
                              {trip.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-white/70">
                      No trips yet. Create one to get started.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card
                className="group bg-white/5 transition hover:-translate-y-1 hover:bg-white/10"
                onClick={focusCreateInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    focusCreateInput(event)
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <CardHeader className="items-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white/80 transition group-hover:bg-white/15 group-hover:text-white">
                    <Plus className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-white">
                    Create New Trip
                  </CardTitle>
                  <CardDescription className="text-white/70">
                    Name it and you&apos;re ready to roll.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault()
                      createTrip()
                    }}
                  >
                    <Input
                      ref={tripNameInputRef}
                      value={tripName}
                      onChange={(event) => setTripName(event.target.value)}
                      placeholder="Trip name"
                      className="h-12 rounded-2xl border-white/20 bg-white/10 text-base text-white placeholder:text-white/40 focus:border-white/40 focus:bg-white/15"
                    />
                    <Textarea
                      value={tripDescription}
                      onChange={(event) => setTripDescription(event.target.value)}
                      placeholder="Short description (optional)"
                      className="min-h-[96px] rounded-2xl border-white/20 bg-white/10 text-base text-white placeholder:text-white/40 focus:border-white/40 focus:bg-white/15"
                    />
                    <Button
                      type="submit"
                      variant="glass"
                      className="w-full rounded-2xl font-semibold text-white/90 transition hover:-translate-y-0.5 hover:text-white"
                      disabled={isCreating || !tripName.trim()}
                    >
                      {isCreating ? "Creating..." : "Create trip"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card
                className="group bg-white/5 transition hover:-translate-y-1 hover:bg-white/10"
                onClick={focusJoinInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    focusJoinInput(event)
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <CardHeader className="items-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white/80 transition group-hover:bg-white/15 group-hover:text-white">
                    <Users className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-white">
                    Join a Trip
                  </CardTitle>
                  <CardDescription className="text-white/70">
                    Pop in the invite code and go.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault()
                      joinTrip()
                    }}
                  >
                    <Input
                      ref={tripIdInputRef}
                      value={tripId}
                      onChange={(event) => setTripId(event.target.value)}
                      placeholder="Trip code"
                      className="h-12 rounded-2xl border-white/20 bg-white/10 text-base text-white placeholder:text-white/40 focus:border-white/40 focus:bg-white/15"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full rounded-2xl border-white/40 font-semibold text-white/90 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/70 hover:text-white"
                      disabled={isJoining || !tripId.trim()}
                    >
                      {isJoining ? "Joining..." : "Join trip"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
