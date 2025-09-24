"use client"

import { useState, useEffect, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { X, Edit, Trash2, Check } from "lucide-react"
import { supabase, type Participant } from "@/lib/supabase/client"

interface ManageParticipantsModalProps {
  tripId: string
  onClose: () => void
  onParticipantsChange?: (participants: Participant[]) => void
}

export function ManageParticipantsModal({ tripId, onClose, onParticipantsChange }: ManageParticipantsModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  const fetchParticipants = useCallback(async () => {
    const { data } = await supabase
      .from("participants")
      .select("*")
      .eq("trip_id", tripId)
      .order("name")
    const list = data || []
    setParticipants(list)
    onParticipantsChange?.(list)
  }, [tripId, onParticipantsChange])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  const addParticipant = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from("participants")
      .insert({ trip_id: tripId, name: newName.trim() })
      .select()
      .single()
    if (!error && data) {
      const updated = [...participants, data]
      setParticipants(updated)
      onParticipantsChange?.(updated)
      setNewName("")
    }
  }

  const saveParticipant = async (id: string) => {
    if (!editingName.trim()) return
    const { error } = await supabase
      .from("participants")
      .update({ name: editingName.trim() })
      .eq("id", id)
    if (!error) {
      const updated = participants.map(p => (p.id === id ? { ...p, name: editingName.trim() } : p))
      setParticipants(updated)
      onParticipantsChange?.(updated)
      setEditingId(null)
      setEditingName("")
    }
  }

  const deleteParticipant = async (id: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", id)
    if (!error) {
      const updated = participants.filter(p => p.id !== id)
      setParticipants(updated)
      onParticipantsChange?.(updated)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 md:inset-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 z-50 w-full md:max-w-md outline-none">
          <Card className="max-h-[90vh] flex flex-col rounded-t-[28px] border-none py-0 md:rounded-[28px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-4 pt-6">
              <CardTitle className="text-lg font-semibold text-white">Manage Participants</CardTitle>
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
                  placeholder="Add new participant..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addParticipant()}
                  className="flex-1 h-10 rounded-2xl border-white/20 bg-white/10 px-3 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                  autoComplete="off"
                />
                <Button size="sm" onClick={addParticipant} variant="glass" className="h-10 rounded-2xl px-4 text-white/90">
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-2xl p-3 text-white/80 glass-sm">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          dir="auto"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-9 flex-1 rounded-2xl border-white/20 bg-white/10 px-3 text-white placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-white/30"
                        />
                        <Button variant="ghostLight" size="sm" onClick={() => saveParticipant(p.id)} className="h-8 w-8 p-0 text-white/80 hover:text-white">
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span dir="auto" className="flex-1 truncate font-medium text-white">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghostLight"
                            size="sm"
                            onClick={() => {
                              setEditingId(p.id)
                              setEditingName(p.name)
                            }}
                            className="h-8 w-8 p-0 text-white/80 hover:text-white"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghostLight"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                            onClick={() => deleteParticipant(p.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {participants.length === 0 && (
                  <p className="py-4 text-center text-white/60">No participants yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
