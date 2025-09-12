"use client";
import { createContext, useContext, useState, ReactNode } from "react";

export type Msg = { role: "user" | "assistant"; text: string };

interface Meta { provider: string; model: string }

interface Store {
  open: boolean;
  activeTripId: string | null;
  messages: Record<string, Msg[]>;
  meta: Record<string, Meta>;
  openForTrip(id: string): void;
  close(): void;
  addMessage(id: string, msg: Msg): void;
  setMeta(id: string, info: Meta): void;
}

const Ctx = createContext<Store | null>(null);

export function AIChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Msg[]>>({});
  const [meta, setMeta] = useState<Record<string, Meta>>({});

  const openForTrip = (id: string) => {
    setActiveTripId(id);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const addMessage = (id: string, msg: Msg) =>
    setMessages((m) => ({ ...m, [id]: [...(m[id] || []), msg] }));
  const setMetaForTrip = (id: string, info: Meta) =>
    setMeta((m) => ({ ...m, [id]: info }));

  return (
    <Ctx.Provider value={{ open, activeTripId, messages, meta, openForTrip, close, addMessage, setMeta: setMetaForTrip }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAIChat() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AIChatProvider missing");
  return ctx;
}
