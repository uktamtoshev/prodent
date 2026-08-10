import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

/**
 * What the metric SAYS, not what colour the author liked.
 *
 * These tiles used to take an `accentColor` of teal/emerald/violet/amber/blue/
 * rose, picked per call site. The result was a four-colour rainbow across one
 * KPI row where the hues meant nothing — an amber "Debt" tile looked like a
 * warning and a violet "Refunds" tile looked like nothing at all, and none of
 * it was learnable. A dashboard is for reading numbers, so colour is spent only
 * where it carries information.
 */
export type StatTone = "neutral" | "success" | "warning" | "danger" | "info";

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  loading?: boolean;
  /** Defaults to `neutral` — most metrics are just a number. */
  tone?: StatTone;
  href?: string;
}

const TONES: Record<StatTone, { iconBg: string; iconText: string }> = {
  neutral: { iconBg: "bg-muted", iconText: "text-muted-foreground" },
  success: { iconBg: "bg-status-success-bg", iconText: "text-status-success" },
  warning: { iconBg: "bg-status-warning-bg", iconText: "text-status-warning" },
  danger: { iconBg: "bg-status-danger-bg", iconText: "text-status-danger" },
  info: { iconBg: "bg-status-info-bg", iconText: "text-status-info" },
};

export function DashboardStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  loading,
  tone = "neutral",
  href,
}: DashboardStatCardProps) {
  const colors = TONES[tone];

  const card = (
    <Card className={cn(
      "relative overflow-hidden border-border bg-card",
      "transition-colors hover:border-primary/40",
      "group",
      href ? "cursor-pointer focus-within:ring-2 focus-within:ring-ring" : "cursor-default",
    )}>
      {/* Плитка KPI по макету: отступ 12/14, подпись 12.5px, число 26px/700
          табличными цифрами. Табличные цифры обязательны: без них 1 и 7 разной
          ширины, и ряд из четырёх чисел «дышит» при каждом обновлении. */}
      <CardContent className="relative px-card-x py-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-meta font-medium text-muted-foreground">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-24 bg-muted" />
            ) : (
              <>
                <p className="text-kpi tabular-nums text-foreground font-heading">
                  {value}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-meta text-muted-foreground">{subtitle}</span>
                  {/* The one place colour is earned: direction of travel. The
                      sign is spelled out too, so the meaning survives without
                      colour (WCAG 1.4.1). */}
                  {trend && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                      trend.positive
                        ? "bg-status-success-bg text-status-success"
                        : "bg-status-danger-bg text-status-danger"
                    )}>
                      {trend.positive ? "+" : "−"}{Math.abs(trend.value)}%
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          
          <div className={cn("rounded-field p-2", colors.iconBg)}>
            <Icon aria-hidden="true" className={cn("h-4 w-4", colors.iconText)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link to={href} aria-label={`${title}: ${value}`}>{card}</Link> : card;
}
