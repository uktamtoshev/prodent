import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "teal" | "amber" | "rose" | "emerald" | "sky" | "violet";

export interface DesignBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children: ReactNode;
}

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  teal: "bg-primary/10 text-primary ring-primary/20",
  amber: "bg-warning-amber/15 text-warning-amber ring-warning-amber/30",
  rose: "bg-destructive/10 text-destructive ring-destructive/20",
  emerald: "bg-success-green/10 text-success-green ring-success-green/20",
  sky: "bg-secondary text-secondary-foreground ring-border",
  violet: "bg-accent text-accent-foreground ring-border",
};

export function DesignBadge({ tone = "neutral", className, children, ...rest }: DesignBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        tones[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
