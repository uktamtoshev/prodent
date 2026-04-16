import { Card, CardContent } from "@/components/ui/card";
import { 
  DollarSign, 
  Users, 
  CalendarCheck, 
  TrendingUp, 
  Percent, 
  AlertCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";

interface Stats {
  totalRevenue: number;
  revenueTrend: number;
  uniquePatients: number;
  patientsTrend: number;
  completedAppointments: number;
  appointmentsTrend: number;
  averageCheck: number;
  averageCheckTrend: number;
  conversionRate: number;
  conversionTrend: number;
  totalDebt: number;
  debtorsCount: number;
}

interface FinanceDashboardStatsProps {
  stats: Stats;
  currency: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  isNegative?: boolean;
}

function StatCard({ title, value, trend, subtitle, icon, iconBg, iconColor, isNegative }: StatCardProps) {
  const hasTrend = trend !== undefined && trend !== 0;
  const isPositiveTrend = trend !== undefined && trend > 0;
  
  return (
    <Card className="relative overflow-hidden border-border/40 bg-card/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:border-primary/20 group">
      {/* Subtle gradient overlay */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br",
        iconBg.replace("bg-", "from-").replace("/10", "/5"),
        "to-transparent"
      )} />
      
      <CardContent className="p-4 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-xl font-bold text-foreground tracking-tight truncate">
              {value}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              )}
              {hasTrend && (
                <span className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5",
                  isNegative 
                    ? (isPositiveTrend ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600")
                    : (isPositiveTrend ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")
                )}>
                  {isPositiveTrend ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          
          <div className={cn(
            "p-2.5 rounded-xl transition-all duration-300 shrink-0",
            iconBg,
            "group-hover:scale-110"
          )}>
            <div className={iconColor}>
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinanceDashboardStats({ stats, currency }: FinanceDashboardStatsProps) {
  const currencyLabel = currency === "USD" ? "$" : "сум";
  
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        title="Выручка"
        value={formatPrice(stats.totalRevenue, currencyLabel, false)}
        trend={stats.revenueTrend}
        subtitle="за период"
        icon={<DollarSign className="w-4 h-4" />}
        iconBg="bg-emerald-500/10"
        iconColor="text-emerald-600 dark:text-emerald-400"
      />
      
      <StatCard
        title="Пациенты"
        value={stats.uniquePatients}
        trend={stats.patientsTrend}
        subtitle="уникальных"
        icon={<Users className="w-4 h-4" />}
        iconBg="bg-blue-500/10"
        iconColor="text-blue-600 dark:text-blue-400"
      />
      
      <StatCard
        title="Приёмы"
        value={stats.completedAppointments}
        trend={stats.appointmentsTrend}
        subtitle="завершённых"
        icon={<CalendarCheck className="w-4 h-4" />}
        iconBg="bg-violet-500/10"
        iconColor="text-violet-600 dark:text-violet-400"
      />
      
      <StatCard
        title="Средний чек"
        value={formatPrice(stats.averageCheck, currencyLabel, false)}
        trend={stats.averageCheckTrend}
        subtitle="на приём"
        icon={<TrendingUp className="w-4 h-4" />}
        iconBg="bg-amber-500/10"
        iconColor="text-amber-600 dark:text-amber-400"
      />
      
      <StatCard
        title="Конверсия"
        value={`${stats.conversionRate.toFixed(1)}%`}
        trend={stats.conversionTrend}
        subtitle="записей"
        icon={<Percent className="w-4 h-4" />}
        iconBg="bg-cyan-500/10"
        iconColor="text-cyan-600 dark:text-cyan-400"
      />
      
      <StatCard
        title="Долги"
        value={formatPrice(stats.totalDebt, currencyLabel, false)}
        subtitle={`${stats.debtorsCount} должников`}
        icon={<AlertCircle className="w-4 h-4" />}
        iconBg="bg-rose-500/10"
        iconColor="text-rose-600 dark:text-rose-400"
        isNegative
      />
    </div>
  );
}
