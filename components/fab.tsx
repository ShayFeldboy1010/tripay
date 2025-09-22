"use client"

import { useState, useEffect, useRef } from "react";
import { Plus, Receipt, MapPin, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useTheme } from "@/theme/ThemeProvider";

interface FABProps {
  onAddExpense: () => void;
  onAddLocation: () => void;
  onAddParticipants: () => void;
}

export function FAB({ onAddExpense, onAddLocation, onAddParticipants }: FABProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();
  const { colors } = useTheme();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      containerRef.current?.focus();
      window.addEventListener("keydown", handleKey);
    }
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const actions = [
    { icon: Users, onClick: onAddParticipants, label: "Participants" },
    { icon: MapPin, onClick: onAddLocation, label: "Location" },
    { icon: Receipt, onClick: onAddExpense, label: "Expense" },
  ];

  return (
    <Tooltip.Provider>
    <div>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <div
        ref={containerRef}
        tabIndex={-1}
        className="fixed z-50 right-4"
        style={{ bottom: isDesktop ? "2rem" : `calc(6rem + env(safe-area-inset-bottom))` }}
      >
        <AnimatePresence>
          {open && (
            <div className="absolute inset-0">
              {actions.map((a, i) => {
                const angle = (-90 - i * 45) * (Math.PI / 180);
                const radius = 120;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const Icon = a.icon;
                return (
                  <motion.div
                    key={a.label}
                    initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    animate={{ scale: 1, x, y, opacity: 1 }}
                    exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="absolute flex flex-col items-center"
                  >
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={() => {
                            a.onClick();
                            setOpen(false);
                          }}
                          aria-label={a.label}
                          className="h-14 w-14 rounded-full flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content
                        side="top"
                        className="rounded px-2 py-1 text-xs"
                        style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
                      >
                        {a.label}
                      </Tooltip.Content>
                    </Tooltip.Root>
                    <span dir="auto" className="mt-1 text-xs text-gray-900 bg-white px-1 rounded">
                      {a.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
        <button
          aria-label="Open menu"
          onClick={() => setOpen((p) => !p)}
          className="h-14 w-14 rounded-full flex items-center justify-center shadow-lg"
          style={{
            backgroundColor: open ? colors.primary700 : colors.primary,
            color: colors.onPrimary,
          }}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
    </Tooltip.Provider>
  );
}
