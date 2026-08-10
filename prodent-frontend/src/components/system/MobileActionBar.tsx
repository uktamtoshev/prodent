import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useSystemLabel } from "./system-labels";

export interface MobileActionBarProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

export function MobileActionBar({ children, label, className }: MobileActionBarProps) {
  const systemLabel = useSystemLabel();
  return (
    <>
      <div
        data-mobile-action-spacer
        aria-hidden="true"
        className="h-[calc(4.25rem+env(safe-area-inset-bottom))] md:hidden"
      />
      <div
        role="toolbar"
        aria-label={label ?? systemLabel("actions")}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg md:hidden",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
