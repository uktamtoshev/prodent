import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TodayScheduleProps {
  doctorId?: string;
  clinicId?: string;
}

export function TodaySchedule({ doctorId, clinicId }: TodayScheduleProps) {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["today-appointments", clinicId, doctorId],
    queryFn: async () => {
      if (!clinicId) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let query = supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          service,
          status,
          price,
          patient_id,
          profiles:patient_id (
            full_name,
            phone
          )
        `)
        .eq("clinic_id", clinicId)
        .gte("appointment_date", today.toISOString())
        .lt("appointment_date", tomorrow.toISOString())
        .order("appointment_date", { ascending: true });

      // Filter by doctor if provided (for doctor-specific views)
      if (doctorId) {
        query = query.eq("doctor_id", doctorId);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!clinicId,
    refetchInterval: 30000,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Ожидает", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
      confirmed: { label: "Подтверждено", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
      completed: { label: "Завершено", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
      cancelled: { label: "Отменено", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
    };
    return variants[status] || variants.pending;
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Календарь на сегодня
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full bg-muted" />
            ))}
          </div>
        ) : appointments && appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((apt) => {
              const status = getStatusBadge(apt.status || "pending");
              const patient = apt.profiles as any;
              
              return (
                <div
                  key={apt.id}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border transition-all duration-200",
                    "bg-muted/30 border-border/50",
                    "hover:bg-muted/50 hover:border-primary/20 hover:shadow-soft cursor-pointer"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center",
                    "bg-primary/10"
                  )}>
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-foreground font-semibold">
                        {format(new Date(apt.appointment_date), "HH:mm", { locale: ru })}
                      </span>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate">{patient?.full_name || "Пациент"}</span>
                      <span className="text-border">•</span>
                      <span className="truncate">{apt.service}</span>
                    </div>
                  </div>
                  {apt.price && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-foreground font-semibold">
                        {apt.price.toLocaleString()} UZS
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>На сегодня записей нет</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
