import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ExpenseCardSkeleton() {
  return (
    <Card
      role="status"
      aria-label="Loading expense"
      className="bg-white/70 backdrop-blur-sm border-white/40 shadow-sm rounded-xl"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" radius="sm" />
            <Skeleton className="h-3 w-1/2" radius="sm" />
          </div>
          <Skeleton className="h-6 w-16" radius="md" />
        </div>
        <Skeleton className="h-3 w-2/3" radius="sm" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" radius="sm" />
          <Skeleton className="h-4 w-20" radius="sm" />
        </div>
      </CardContent>
    </Card>
  )
}
