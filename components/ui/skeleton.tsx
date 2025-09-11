import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const skeletonVariants = cva("bg-[var(--skeleton-base)]", {
  variants: {
    variant: {
      shimmer: "skeleton-shimmer",
      pulse: "animate-pulse",
      static: "",
    },
    radius: {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
      full: "rounded-full",
    },
  },
  defaultVariants: {
    variant: "shimmer",
    radius: "md",
  },
})

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

export function Skeleton({ className, variant, radius, ...props }: SkeletonProps) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const currentVariant = reducedMotion && variant === "shimmer" ? "static" : variant

  return (
    <div
      aria-hidden="true"
      className={cn(skeletonVariants({ variant: currentVariant, radius }), className)}
      {...props}
    />
  )
}
