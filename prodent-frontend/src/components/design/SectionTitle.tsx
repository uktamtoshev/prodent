import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionTitleProps {
  children: ReactNode;
  right?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}

export function SectionTitle({ children, right, subtitle, className }: SectionTitleProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-3", className)}>
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight font-display">{children}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
