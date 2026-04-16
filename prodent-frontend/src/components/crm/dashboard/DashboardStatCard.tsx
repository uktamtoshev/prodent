import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  loading?: boolean;
  accentColor?: "teal" | "emerald" | "violet" | "amber" | "blue" | "rose";
}

const accentColors = {
  teal: {
    iconBg: "bg-teal-500/10 group-hover:bg-teal-500",
    iconText: "text-teal-600 dark:text-teal-400 group-hover:text-white",
    gradient: "from-teal-500/5 to-transparent",
  },
  emerald: {
    iconBg: "bg-emerald-500/10 group-hover:bg-emerald-500",
    iconText: "text-emerald-600 dark:text-emerald-400 group-hover:text-white",
    gradient: "from-emerald-500/5 to-transparent",
  },
  violet: {
    iconBg: "bg-violet-500/10 group-hover:bg-violet-500",
    iconText: "text-violet-600 dark:text-violet-400 group-hover:text-white",
    gradient: "from-violet-500/5 to-transparent",
  },
  amber: {
    iconBg: "bg-amber-500/10 group-hover:bg-amber-500",
    iconText: "text-amber-600 dark:text-amber-400 group-hover:text-white",
    gradient: "from-amber-500/5 to-transparent",
  },
  blue: {
    iconBg: "bg-blue-500/10 group-hover:bg-blue-500",
    iconText: "text-blue-600 dark:text-blue-400 group-hover:text-white",
    gradient: "from-blue-500/5 to-transparent",
  },
  rose: {
    iconBg: "bg-rose-500/10 group-hover:bg-rose-500",
    iconText: "text-rose-600 dark:text-rose-400 group-hover:text-white",
    gradient: "from-rose-500/5 to-transparent",
  },
};

export function DashboardStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  loading,
  accentColor = "teal",
}: DashboardStatCardProps) {
  const colors = accentColors[accentColor];

  return (
    <Card className={cn(
      "relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm",
      "hover:shadow-medium transition-all duration-300 hover:border-primary/20",
      "group cursor-default"
    )}>
      {/* Subtle gradient overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity",
        colors.gradient
      )} />
      
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-24 bg-muted" />
            ) : (
              <>
                <p className="text-2xl md:text-3xl font-bold text-foreground tracking-tight font-heading">
                  {value}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                  {trend && (
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded-full",
                      trend.positive 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    )}>
                      {trend.positive ? "+" : ""}{trend.value}%
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          
          <div className={cn(
            "p-3 rounded-xl transition-all duration-300",
            colors.iconBg
          )}>
            <Icon className={cn("w-5 h-5 transition-colors", colors.iconText)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
