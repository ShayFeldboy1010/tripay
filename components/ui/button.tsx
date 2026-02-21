import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 focus-visible:ring-offset-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--brand-primary)] text-white shadow-md hover:brightness-110",
        destructive:
          "bg-red-500/80 text-white shadow-md hover:bg-red-500/90",
        outline:
          "border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/25 hover:text-white",
        secondary:
          "bg-white/10 text-white/90 hover:bg-white/15 hover:text-white",
        ghost:
          "text-white/70 hover:bg-white/8 hover:text-white",
        glass:
          "glass text-white/90 hover:text-white hover:border-white/20",
        ghostLight:
          "bg-transparent text-white/70 hover:text-white hover:bg-white/5",
        link:
          "text-[var(--brand-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg gap-1.5 px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-base",
        icon: "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
