"use client"

import { useState, useEffect, useRef } from "react";
import { Plus, Receipt, MapPin, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

interface FABProps {
  onAddExpense: () => void;
  onAddLocation: () => void;
  onAddParticipants: () => void;
}

export function FAB({ onAddExpense, onAddLocation, onAddParticipants }: FABProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    { icon: Receipt, onClick: onAddExpense, label: "Add Expense" },
    { icon: MapPin, onClick: onAddLocation, label: "Add Location" },
    { icon: Users, onClick: onAddParticipants, label: "Add Participants" },
  ];

  return (
    <div className="lg:hidden" >
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <div
        ref={containerRef}
        tabIndex={-1}
        className="fixed z-50 right-4"
        style={{ bottom: `calc(6rem + env(safe-area-inset-bottom))` }}
      >
        <AnimatePresence>
          {open && (
            <div className="absolute inset-0">
              {actions.map((a, i) => {
                const angle = (-90 - i * 30) * (Math.PI / 180);
                const radius = 80;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const Icon = a.icon;
                return (
                  <motion.button
                    key={a.label}
                    initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    animate={{ scale: 1, x, y, opacity: 1 }}
                    exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={() => {
                      a.onClick();
                      setOpen(false);
                    }}
                    aria-label={a.label}
                    className="absolute h-12 w-12 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-lg"
                  >
                    <Icon className="h-5 w-5" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>
        <button
          aria-label="Open menu"
          onClick={() => setOpen((p) => !p)}
          className={clsx(
            "h-14 w-14 rounded-full flex items-center justify-center shadow-lg text-white", 
            open ? "bg-gray-700" : "bg-gray-900"
          )}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
