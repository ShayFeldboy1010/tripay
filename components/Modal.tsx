"use client";

import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  containerClassName?: string;
  contentClassName?: string;
  overlayClassName?: string;
  restoreFocus?: boolean;
};

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  describedBy,
  initialFocusRef,
  containerClassName,
  contentClassName,
  overlayClassName,
  restoreFocus = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const previousOverflow = useRef<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");

    const focusTarget = initialFocusRef?.current ?? contentRef.current;
    requestAnimationFrame(() => {
      focusTarget?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const node = contentRef.current;
      if (!node) return;

      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
        (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
      );

      if (!focusable.length) {
        event.preventDefault();
        node.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isShift = event.shiftKey;
      const active = document.activeElement as HTMLElement | null;

      if (!isShift && active === last) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (isShift && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow.current;
      document.body.classList.remove("modal-open");
      if (restoreFocus && lastFocusedRef.current) {
        lastFocusedRef.current.focus();
      }
    };
  }, [initialFocusRef, onClose, open, restoreFocus]);

  if (!mounted || !open) {
    return null;
  }

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex min-100dvh min-vh items-center justify-center px-4 py-6 sm:px-6",
        containerClassName
      )}
      role="presentation"
    >
      <div
        className={cn("absolute inset-0 bg-black/70 backdrop-blur-sm", overlayClassName)}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn(
          "pointer-events-auto relative flex w-full max-h-[calc(100dvh-2rem-var(--safe-top)-var(--safe-bottom))] min-h-0 flex-col overflow-hidden rounded-[28px] border border-[color:var(--chat-border-soft)]/60 bg-[color:var(--chat-bg-card)]/95 text-white shadow-[0_20px_48px_rgba(4,7,18,0.55)]",
          contentClassName
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
