"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { X, Edit, Trash2, Check } from "lucide-react"
import { supabase, type Location } from "@/lib/supabase/client"

interface ManageLocationsModalProps {
  tripId: string
  onClose: () => void
}

export function ManageLocationsModal({ tripId, onClose }: ManageLocationsModalProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  useEffect(() => {
    fetchLocations()
  }, [tripId])

  const fetchLocations = async () => {
    const { data } = await supabase
      .from("locations")
      .select("*")
      .eq("trip_id", tripId)
      .order("name")
    setLocations(data || [])
  }

  const addLocation = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from("locations")
      .insert({ trip_id: tripId, name: newName.trim() })
      .select()
      .single()
    if (!error && data) {
      setLocations([...locations, data])
      setNewName("")
    }
  }

  const saveLocation = async (id: string) => {
    if (!editingName.trim()) return
    const { error } = await supabase
      .from("locations")
      .update({ name: editingName.trim() })
      .eq("id", id)
    if (!error) {
      setLocations(locations.map(l => (l.id === id ? { ...l, name: editingName.trim() } : l)))
      setEditingId(null)
      setEditingName("")
    }
  }

  const deleteLocation = async (id: string) => {
    const { error } = await supabase.from("locations").delete().eq("id", id)
    if (!error) {
      setLocations(locations.filter(l => l.id !== id))
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 md:inset-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 z-50 w-full md:max-w-md outline-none">
          <Card className="rounded-t-2xl md:rounded-2xl border-0 shadow-2xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-4 px-4 md:px-6 pt-4 md:pt-6">
              <CardTitle className="text-lg font-semibold">Manage Locations</CardTitle>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full hover:bg-gray-100">
                  <X className="h-5 w-5" />
                </Button>
              </Dialog.Close>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 overflow-y-auto flex-1">
              <div className="flex gap-2 mb-4">
                <Input
                  dir="auto"
                  placeholder="Add new location..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLocation()}
                  className="flex-1 h-10"
                  autoComplete="off"
                />
                <Button size="sm" onClick={addLocation} className="h-10">
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {locations.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    {editingId === l.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          dir="auto"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 flex-1"
                        />
                        <Button variant="ghost" size="sm" onClick={() => saveLocation(l.id)} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span dir="auto" className="font-medium flex-1 truncate">
                          {l.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(l.id)
                              setEditingName(l.name)
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 h-8 w-8 p-0"
                            onClick={() => deleteLocation(l.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {locations.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No locations yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
