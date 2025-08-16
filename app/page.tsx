"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase/client"
import { Plus, Users } from "lucide-react"

export default function HomePage() {
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [tripName, setTripName] = useState("")
  const [tripDescription, setTripDescription] = useState("")
  const [tripId, setTripId] = useState("")
  const router = useRouter()

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

      // Navigate to the trip page
      router.push(`/trip/${data.id}`)
    } catch (error) {
      console.error("Error creating trip:", error)
      alert("Failed to create trip. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const joinTrip = async () => {
    if (!tripId.trim()) return

    setIsJoining(true)
    try {
      // Check if trip exists
      const { data, error } = await supabase.from("trips").select("id").eq("id", tripId.trim()).single()

      if (error || !data) {
        alert("Trip not found. Please check the Trip ID.")
        return
      }

      // Navigate to the trip page
      router.push(`/trip/${tripId.trim()}`)
    } catch (error) {
      console.error("Error joining trip:", error)
      alert("Failed to join trip. Please try again.")
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto pt-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Trip Expenses</h1>
          <p className="text-gray-600">Share expenses with friends instantly</p>
        </div>

        <div className="space-y-6">
          {/* Create Trip Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Create New Trip
              </CardTitle>
              <CardDescription>Start a new trip and get a shareable Trip ID</CardDescription>
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
                  onChange={(e) => setTripName(e.target.value)}
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
                  onChange={(e) => setTripDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <Button
                onClick={createTrip}
                disabled={!tripName.trim() || isCreating}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isCreating ? "Creating..." : "Create Trip"}
              </Button>
            </CardContent>
          </Card>

          {/* Join Trip Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Join Existing Trip
              </CardTitle>
              <CardDescription>Enter a Trip ID shared by a friend</CardDescription>
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
                  onChange={(e) => setTripId(e.target.value)}
                />
              </div>
              <Button
                onClick={joinTrip}
                disabled={!tripId.trim() || isJoining}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isJoining ? "Joining..." : "Join Trip"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sample Trip ID for testing */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 mb-2">
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
