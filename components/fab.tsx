"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Plus, Receipt, Users } from "lucide-react";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface FABProps {
  onAddExpense: () => void;
  onAddLocation: () => void;
  onAddParticipants: () => void;
}

export function FAB({ onAddExpense, onAddLocation, onAddParticipants }: FABProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener("keydown", handleKey);
    }
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const actions = [
    { icon: Receipt, label: "הוספת הוצאה", onClick: onAddExpense },
    { icon: MapPin, label: "מיקום חדש", onClick: onAddLocation },
    { icon: Users, label: "משתתפים", onClick: onAddParticipants },
  ];

  const bottomOffset = isDesktop ? "1.5rem" : `calc(1.5rem + env(safe-area-inset-bottom))`;

  return (
    <>
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        className="fixed right-6 z-50 flex flex-col items-end gap-3"
        style={{ bottom: bottomOffset }}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="flex flex-col items-end gap-3"
            >
              {actions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.label}
                    type="button"
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.95 }}
                    transition={{ delay: index * 0.05, type: "spring", stiffness: 280, damping: 22 }}
                    onClick={() => {
                      action.onClick();
                      setOpen(false);
                    }}
                    className="pill bg-primary-200 flex items-center gap-3 text-white/90 ring-1 ring-white/10 shadow-glass transition hover:ring-white/20"
                  >
                    <span className="flex size-9 items-center justify-center rounded-2xl bg-primary-200 text-white/90">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-semibold">{action.label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          aria-expanded={open}
          aria-label="פתח תפריט הוספה"
          onClick={() => setOpen((prev) => !prev)}
          className="size-14 rounded-full bg-gradient-to-b from-primary-600 to-primary-500 text-white/95 shadow-glass transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15 active:scale-[0.97]"
        >
          <Plus className="size-6" />
        </button>
      </div>
    </>
  );
}
