"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import type { ExpensesChatMetaEvent, ExpensesChatResult } from "@/services/ai/askAI";

export type Msg =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      streaming?: boolean;
      result?: ExpensesChatResult | null;
      error?: string | null;
      meta?: ExpensesChatMetaEvent | null;
      reconnecting?: boolean;
    };

interface Meta {
  provider: string;
  model: string;
}

interface Store {
  open: boolean;
  activeTripId: string | null;
  messages: Record<string, Msg[]>;
  meta: Record<string, Meta>;
  openForTrip(id: string): void;
  close(): void;
  addMessage(id: string, msg: Msg): void;
  updateLastMessage(id: string, updater: (prev: Msg) => Msg): void;
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

  const updateLastMessage = (id: string, updater: (prev: Msg) => Msg) => {
    setMessages((current) => {
      const list = current[id];
      if (!list || list.length === 0) return current;
      const next = [...list];
      next[next.length - 1] = updater(next[next.length - 1]);
      return { ...current, [id]: next };
    });
  };
  const setMetaForTrip = (id: string, info: Meta) =>
    setMeta((m) => ({ ...m, [id]: info }));

  return (
    <Ctx.Provider
      value={{ open, activeTripId, messages, meta, openForTrip, close, addMessage, updateLastMessage, setMeta: setMetaForTrip }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAIChat() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AIChatProvider missing");
  return ctx;
}
