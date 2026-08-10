import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useSystemLabel } from "./system-labels";

export interface TimelineItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
}

export interface TimelineProps {
  items: readonly TimelineItem[];
  label?: string;
  className?: string;
}

export function Timeline({ items, label, className }: TimelineProps) {
  const systemLabel = useSystemLabel();
  return (
    <ol aria-label={label ?? systemLabel("timeline")} className={cn("space-y-0", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative grid grid-cols-[2rem_1fr] gap-3 pb-6 last:pb-0">
          {index < items.length - 1 ? <span aria-hidden="true" className="absolute left-4 top-8 h-[calc(100%-2rem)] w-px bg-border" /> : null}
          <span className="z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
            {item.icon ?? <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />}
          </span>
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-medium text-foreground">{item.title}</div>
              {item.meta ? <div className="text-xs text-muted-foreground">{item.meta}</div> : null}
            </div>
            {item.description ? <div className="mt-1 text-sm text-muted-foreground">{item.description}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
