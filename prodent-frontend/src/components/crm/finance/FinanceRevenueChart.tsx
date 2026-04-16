import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface FinanceRevenueChartProps {
  data: Array<{ date: string; revenue: number }>;
  currency: string;
}

export function FinanceRevenueChart({ data, currency }: FinanceRevenueChartProps) {
  const currencyLabel = currency === "USD" ? "$" : "сум";
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Динамика выручки
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            Итого: <span className="font-semibold text-foreground">{formatPrice(totalRevenue, currencyLabel, false)}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            Нет данных за выбранный период
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "11px" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "11px" }}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  color: "hsl(var(--card-foreground))",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  padding: "10px 14px",
                }}
                formatter={(value: number) => [formatPrice(value, currencyLabel, false), "Выручка"]}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
