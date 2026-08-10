import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DesignCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  pad?: string;
}

export function DesignCard({ children, className, pad = "p-5", ...rest }: DesignCardProps) {
  return (
    <div
      className={cn(
        "rounded-prodent border border-border bg-card text-card-foreground shadow-card",
        pad,
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
