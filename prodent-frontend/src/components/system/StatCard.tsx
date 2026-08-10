import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { label: string; tone?: "positive" | "negative" | "neutral" };
  className?: string;
}

export function StatCard({ label, value, hint, icon, trend, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
          {trend ? (
            <p
              className={cn(
                "mt-2 text-sm font-medium",
                trend.tone === "positive" && "text-success-green",
                trend.tone === "negative" && "text-destructive",
                (!trend.tone || trend.tone === "neutral") && "text-muted-foreground",
              )}
            >
              {trend.label}
            </p>
          ) : null}
        </div>
        {icon ? <div className="shrink-0 rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}
