"use client";
import { MessageCircle } from "lucide-react";
import { useAIChat } from "./AIChatStore";

export function AIChatBubble({ tripId }: { tripId: string }) {
  const { openForTrip } = useAIChat();
  return (
    <button
      aria-label="Open AI chat"
      onClick={() => openForTrip(tripId)}
      style={{
        position: "fixed",
        left: 16,
        bottom: "calc(env(safe-area-inset-bottom) + 88px)",
        zIndex: 9999,
        pointerEvents: "auto",
      }}
      className="glass flex h-14 w-14 items-center justify-center rounded-full text-white transition hover:text-white/90"
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
}
