import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface Service {
  name: string;
  count: number;
  revenue: number;
}

interface FinanceTopServicesProps {
  services: Service[];
  currency: string;
}

const barColors = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-cyan-500",
];

export function FinanceTopServices({ services, currency }: FinanceTopServicesProps) {
  const currencyLabel = currency === "USD" ? "$" : "сум";
  const maxRevenue = Math.max(...services.map(s => s.revenue), 1);

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-violet-500" />
          Топ услуги
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
        ) : (
          services.map((service, idx) => (
            <div key={service.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium truncate max-w-[140px]">
                  {service.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {service.count} шт
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      barColors[idx % barColors.length]
                    )}
                    style={{ width: `${(service.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-foreground min-w-[70px] text-right">
                  {formatPrice(service.revenue, currencyLabel, false)}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
