"use client";
import { MessageCircle } from "lucide-react";
import { useAIChat } from "./AIChatStore";

export function AIChatBubble({ tripId }: { tripId: string }) {
  const { openForTrip } = useAIChat();
  return (
    <button
      aria-label="Open AI chat"
      onClick={() => openForTrip(tripId)}
      className="btn-glass fixed bottom-24 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-white/15 text-white/90 transition active:scale-95 md:left-6"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
}
