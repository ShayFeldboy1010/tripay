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
        bottom: "calc(env(safe-area-inset-bottom) + 80px)",
        zIndex: 9999,
        pointerEvents: "auto",
      }}
      className="glass flex h-12 w-12 items-center justify-center rounded-2xl text-white/70 transition-all duration-200 hover:text-white hover:scale-105 active:scale-95"
    >
      <MessageCircle className="w-5 h-5" />
    </button>
  );
}
