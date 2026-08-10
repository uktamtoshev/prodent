import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { subDays } from "date-fns";

interface RevenueByServiceChartProps {
  period: string;
}

const COLORS = ["hsl(var(--primary))", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export function RevenueByServiceChart({ period }: RevenueByServiceChartProps) {
  const { currentClinic } = useClinic();
  
  const days = period === "7days" ? 7 : period === "30days" ? 30 : period === "3months" ? 90 : 365;
  const startDate = subDays(new Date(), days);

  const { data, isLoading } = useQuery({
    queryKey: ["revenue-by-service", currentClinic?.id, period],
    queryFn: async () => {
      const { data: appointments } = await supabase
        .from("appointments")
        .select("service, total_price")
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .gte("appointment_date", startDate.toISOString());

      const serviceMap: Record<string, number> = {};
      
      appointments?.forEach((apt) => {
        const service = apt.service || "Прочее";
        serviceMap[service] = (serviceMap[service] || 0) + (apt.total_price || 0);
      });

      return Object.entries(serviceMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    },
    enabled: !!currentClinic?.id,
  });

  const total = data?.reduce((sum, item) => sum + item.value, 0) || 0;

  if (isLoading) {
    return <Skeleton className="h-80 w-full bg-muted" />;
  }

  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="text-foreground">Выручка по услугам</CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={280}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} UZS`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {data.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-foreground truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-foreground font-medium">
                      {item.value.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground ml-1">
                      ({((item.value / total) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Нет данных за выбранный период
          </div>
        )}
      </CardContent>
    </Card>
  );
}
