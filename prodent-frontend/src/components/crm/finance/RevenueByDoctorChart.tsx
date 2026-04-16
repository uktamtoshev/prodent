import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { subDays } from "date-fns";

interface RevenueByDoctorChartProps {
  period: string;
}

const COLORS = ["hsl(var(--primary))", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function RevenueByDoctorChart({ period }: RevenueByDoctorChartProps) {
  const { currentClinic } = useClinic();
  
  const days = period === "7days" ? 7 : period === "30days" ? 30 : period === "3months" ? 90 : 365;
  const startDate = subDays(new Date(), days);

  const { data, isLoading } = useQuery({
    queryKey: ["revenue-by-doctor", currentClinic?.id, period],
    queryFn: async () => {
      // Get only staff doctors
      const { data: staffDoctors } = await supabase
        .from("doctors")
        .select("id")
        .eq("clinic_id", currentClinic?.id)
        .eq("cooperation_type", "staff_doctor");
      
      if (!staffDoctors?.length) return [];
      
      const staffDoctorIds = staffDoctors.map(d => d.id);
      
      const { data: appointments } = await supabase
        .from("appointments")
        .select(`
          price,
          doctor:doctors(id, cooperation_type, profiles:user_id(full_name))
        `)
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .in("doctor_id", staffDoctorIds)
        .gte("appointment_date", startDate.toISOString());

      const revenueMap: Record<string, { name: string; revenue: number }> = {};
      
      appointments?.forEach((apt) => {
        const doctorId = (apt.doctor as any)?.id;
        const doctorName = (apt.doctor as any)?.profiles?.full_name || "Неизвестно";
        
        if (!revenueMap[doctorId]) {
          revenueMap[doctorId] = { name: doctorName, revenue: 0 };
        }
        revenueMap[doctorId].revenue += apt.price || 0;
      });

      return Object.values(revenueMap).sort((a, b) => b.revenue - a.revenue);
    },
    enabled: !!currentClinic?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-80 w-full bg-muted" />;
  }

  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="text-foreground">Выручка по штатным врачам</CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number" 
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value.toLocaleString()} UZS`, "Выручка"]}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Нет данных за выбранный период
          </div>
        )}
      </CardContent>
    </Card>
  );
}
