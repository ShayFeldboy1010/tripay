"use client";
import { MessageCircle } from "lucide-react";
import { useTheme } from "@/theme/ThemeProvider";
import { useAIChat } from "./AIChatStore";

const BUBBLE_SIZE = 56;

export function AIChatBubble({ tripId }: { tripId: string }) {
  const { openForTrip } = useAIChat();
  const { colors } = useTheme();
  return (
    <button
      aria-label="Open AI chat"
      onClick={() => openForTrip(tripId)}
      style={{
        position: "fixed",
        left: 16,
        bottom: "calc(env(safe-area-inset-bottom) + 88px)",
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        borderRadius: BUBBLE_SIZE / 2,
        backgroundColor: colors.primary,
        color: colors.onPrimary,
        zIndex: 9999,
        pointerEvents: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
      }}
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
}
