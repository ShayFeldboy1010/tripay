"use client";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTheme } from "@/theme/ThemeProvider";
import { AIChatPanel } from "./AIChatPanel";

export function AIChatBubble({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  return (
    <>
      {open && <AIChatPanel tripId={tripId} onClose={() => setOpen(false)} />}
      <button
        aria-label="Open AI chat"
        onClick={() => setOpen(true)}
        style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
        className="fixed z-40 bottom-4 left-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center focus:outline-none"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </>
  );
}
