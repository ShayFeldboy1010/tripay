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
  onLocationsChange?: (locations: Location[]) => void
}

export function ManageLocationsModal({ tripId, onClose, onLocationsChange }: ManageLocationsModalProps) {
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
    const list = data || []
    setLocations(list)
    onLocationsChange?.(list)
  }

  const addLocation = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from("locations")
      .insert({ trip_id: tripId, name: newName.trim() })
      .select()
      .single()
    if (!error && data) {
      const updated = [...locations, data]
      setLocations(updated)
      onLocationsChange?.(updated)
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
      const updated = locations.map((l) => (l.id === id ? { ...l, name: editingName.trim() } : l))
      setLocations(updated)
      onLocationsChange?.(updated)
      setEditingId(null)
      setEditingName("")
    }
  }

  const deleteLocation = async (id: string) => {
    const { error } = await supabase.from("locations").delete().eq("id", id)
    if (!error) {
      const updated = locations.filter((l) => l.id !== id)
      setLocations(updated)
      onLocationsChange?.(updated)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 md:inset-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 z-50 w-full md:max-w-md outline-none">
          <Card className="max-h-[90vh] flex flex-col rounded-t-[28px] border-none py-0 md:rounded-[28px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-4 pt-6">
              <CardTitle className="text-lg font-semibold text-white">Manage Locations</CardTitle>
              <Dialog.Close asChild>
                <Button variant="ghostLight" size="sm" className="h-9 w-9 rounded-full p-0 text-white/70 hover:text-white">
                  <X className="h-5 w-5" />
                </Button>
              </Dialog.Close>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="mb-4 flex gap-2">
                <Input
                  dir="auto"
                  placeholder="Add new location..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLocation()}
                  className="flex-1 h-10 rounded-2xl border-white/20 bg-white/10 px-3 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                  autoComplete="off"
                />
                <Button size="sm" onClick={addLocation} variant="glass" className="h-10 rounded-2xl px-4 text-white/90">
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {locations.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-2xl p-3 text-white/80 glass-sm">
                    {editingId === l.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          dir="auto"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-9 flex-1 rounded-2xl border-white/20 bg-white/10 px-3 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                        />
                        <Button variant="ghostLight" size="sm" onClick={() => saveLocation(l.id)} className="h-8 w-8 p-0 text-white/80 hover:text-white">
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span dir="auto" className="flex-1 truncate font-medium text-white">
                          {l.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghostLight"
                            size="sm"
                            onClick={() => {
                              setEditingId(l.id)
                              setEditingName(l.name)
                            }}
                            className="h-8 w-8 p-0 text-white/80 hover:text-white"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghostLight"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
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
                  <p className="py-4 text-center text-white/60">No locations yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
