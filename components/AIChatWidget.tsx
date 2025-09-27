"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AIChatBubble } from "./AIChatBubble";
import { AIChatPanel } from "./AIChatPanel";
import { useAIChat } from "./AIChatStore";
import { getActiveTripId } from "@/src/lib/trips/getActiveTripId";

export function AIChatWidget() {
  const pathname = usePathname();
  const { open, openForTrip, close, activeTripId } = useAIChat();
  const [mounted, setMounted] = useState(false);
  const match = pathname.match(/\/trip\/([^/]+)/);
  const currentTrip = match ? match[1] : getActiveTripId();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && currentTrip) {
        e.preventDefault();
        open ? close() : openForTrip(currentTrip);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, currentTrip, openForTrip, close]);

  if (!currentTrip) return null;
  if (!mounted || typeof document === "undefined") return null;

  const tripForPanel = activeTripId || currentTrip;

  return createPortal(
    <>
      {!open && <AIChatBubble tripId={currentTrip} />}
      <AIChatPanel tripId={tripForPanel} open={open} />
    </>,
    document.body,
  );
}
