import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Doctor {
  id: string;
  name: string;
  count: number;
  revenue: number;
}

interface FinanceTopDoctorsProps {
  doctors: Doctor[];
  currency: string;
}

const barColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-cyan-500",
];

export function FinanceTopDoctors({ doctors, currency }: FinanceTopDoctorsProps) {
  const currencyLabel = currency === "USD" ? "$" : "сум";
  const maxRevenue = Math.max(...doctors.map(d => d.revenue), 1);

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-blue-500" />
          Топ врачи
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {doctors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
        ) : (
          doctors.map((doctor, idx) => (
            <div key={doctor.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium truncate max-w-[140px]">
                  {doctor.name || "Врач"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {doctor.count} приёмов
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      barColors[idx % barColors.length]
                    )}
                    style={{ width: `${(doctor.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-foreground min-w-[70px] text-right">
                  {formatPrice(doctor.revenue, currencyLabel, false)}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
