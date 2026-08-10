import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSystemLabel } from "./system-labels";

export interface SkeletonCompositionProps {
  rows?: number;
  cards?: number;
  showHeader?: boolean;
  label?: string;
  className?: string;
}

export function SkeletonComposition({
  rows = 3,
  cards = 0,
  showHeader = true,
  label,
  className,
}: SkeletonCompositionProps) {
  const systemLabel = useSystemLabel();
  const resolvedLabel = label ?? systemLabel("loading");
  return (
    <div role="status" aria-label={resolvedLabel} className={cn("space-y-4", className)}>
      {showHeader ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      ) : null}
      {cards > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
        </div>
      ) : null}
      {rows > 0 ? (
        <div className="space-y-2 rounded-xl border border-border p-4">
          {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
        </div>
      ) : null}
      <span className="sr-only">{resolvedLabel}…</span>
    </div>
  );
}
