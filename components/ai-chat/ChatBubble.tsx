"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "user" | "assistant";
  children: ReactNode;
  meta?: ReactNode;
  streaming?: boolean;
  className?: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function ChatBubble({ role, children, meta, streaming, className, dir = "auto" }: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "group relative flex w-full justify-end",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      <div
        dir={dir}
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed transition-transform duration-150",
          "shadow-lg",
          isUser
            ? "chat-bubble-user rounded-br-[12px] rounded-tl-[18px]"
            : "chat-bubble-assistant rounded-bl-[14px] rounded-tr-[18px]"
        )}
      >
        {streaming && !isUser ? (
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--chat-text-muted)]">
            <Loader2 className="h-3 w-3 animate-spin text-[color:var(--chat-primary)]" />
            Drafting
          </div>
        ) : null}
        <div className="space-y-2 text-[15px] leading-6">
          {children}
        </div>
        {meta ? <div className="mt-2 text-[12px] chat-bubble-meta">{meta}</div> : null}
      </div>
    </div>
  );
}

export function ChatBubbleSkeleton() {
  return <div className="chat-skeleton h-16 w-44 rounded-2xl" aria-hidden="true" />;
}
