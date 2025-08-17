"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import type { Location, Participant } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Plus, ArrowLeft, MapPin, Users } from "lucide-react"
import { MobileNav } from "@/components/mobile-nav"

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string

  const [locations, setLocations] = useState<Location[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newLocationName, setNewLocationName] = useState("")
  const [newParticipantName, setNewParticipantName] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [tripId])

  const fetchData = async () => {
    try {
      const [locationsRes, participantsRes] = await Promise.all([
        supabase.from("locations").select("*").eq("trip_id", tripId).order("name"),
        supabase.from("participants").select("*").eq("trip_id", tripId).order("name"),
      ])

      if (locationsRes.data) setLocations(locationsRes.data)
      if (participantsRes.data) setParticipants(participantsRes.data)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const addLocation = async () => {
    if (!newLocationName.trim()) return

    try {
      const { data, error } = await supabase
        .from("locations")
        .insert({ trip_id: tripId, name: newLocationName.trim() })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setLocations([...locations, data])
        setNewLocationName("")
      }
    } catch (error) {
      console.error("Error adding location:", error)
    }
  }

  const deleteLocation = async (id: string) => {
    try {
      const { error } = await supabase.from("locations").delete().eq("id", id)
      if (error) throw error
      setLocations(locations.filter((l) => l.id !== id))
    } catch (error) {
      console.error("Error deleting location:", error)
    }
  }

  const addParticipant = async () => {
    if (!newParticipantName.trim()) return

    try {
      const { data, error } = await supabase
        .from("participants")
        .insert({ trip_id: tripId, name: newParticipantName.trim() })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setParticipants([...participants, data])
        setNewParticipantName("")
      }
    } catch (error) {
      console.error("Error adding participant:", error)
    }
  }

  const deleteParticipant = async (id: string) => {
    try {
      const { error } = await supabase.from("participants").delete().eq("id", id)
      if (error) throw error
      setParticipants(participants.filter((p) => p.id !== id))
    } catch (error) {
      console.error("Error deleting participant:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 pb-24 md:pb-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 md:mb-8 pt-2 md:pt-0">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()} 
            className="flex items-center gap-2 h-11 min-w-[44px] px-2 md:px-4"
          >
            <ArrowLeft className="h-5 w-5 md:h-4 md:w-4" />
            <span className="hidden md:inline">Back to Trip</span>
          </Button>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900">Trip Settings</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          {/* Locations Management */}
          <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPin className="h-5 w-5 text-blue-600" />
                Locations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add new location..."
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addLocation()}
                  className="flex-1 h-12 md:h-10 text-base md:text-sm"
                  autoComplete="off"
                />
                <Button 
                  onClick={addLocation} 
                  size="sm"
                  className="h-12 w-12 md:h-10 md:w-10 p-0 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
                >
                  <Plus className="h-5 w-5 md:h-4 md:w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {locations.map((location) => (
                  <div key={location.id} className="flex items-center justify-between p-4 md:p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-base md:text-sm flex-1 truncate pr-2">{location.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteLocation(location.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-11 w-11 md:h-8 md:w-8 p-0 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex-shrink-0"
                    >
                      <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
                    </Button>
                  </div>
                ))}
                {locations.length === 0 && <p className="text-gray-500 text-center py-6 md:py-4 text-base md:text-sm">No locations added yet</p>}
              </div>
            </CardContent>
          </Card>

          {/* Participants Management */}
          <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5 text-green-600" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add new participant..."
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addParticipant()}
                  className="flex-1 h-12 md:h-10 text-base md:text-sm"
                  autoComplete="off"
                />
                <Button 
                  onClick={addParticipant} 
                  size="sm"
                  className="h-12 w-12 md:h-10 md:w-10 p-0 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
                >
                  <Plus className="h-5 w-5 md:h-4 md:w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-4 md:p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-base md:text-sm flex-1 truncate pr-2">{participant.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteParticipant(participant.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-11 w-11 md:h-8 md:w-8 p-0 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex-shrink-0"
                    >
                      <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
                    </Button>
                  </div>
                ))}
                {participants.length === 0 && (
                  <p className="text-gray-500 text-center py-6 md:py-4 text-base md:text-sm">No participants added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav tripId={tripId} />
    </div>
  )
}
