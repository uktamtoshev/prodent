import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Bell } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LiveQueueProps {
  doctorId?: string;
  clinicId?: string;
}

export function LiveQueue({ doctorId, clinicId }: LiveQueueProps) {
  const { toast } = useToast();

  const { data: queue, isLoading } = useQuery({
    queryKey: ["live-queue", clinicId, doctorId],
    queryFn: async () => {
      if (!clinicId) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from("appointments_queue")
        .select(`
          id,
          status,
          arrival_time,
          called_time,
          queue_number,
          patient_id,
          profiles:patient_id (
            full_name,
            phone
          ),
          appointments:appointment_id (
            service,
            appointment_date
          )
        `)
        .eq("clinic_id", clinicId)
        .gte("created_at", today.toISOString())
        .in("status", ["waiting", "arrived"])
        .order("queue_number", { ascending: true });

      // Filter by doctor if provided
      if (doctorId) {
        query = query.eq("doctor_id", doctorId);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!clinicId,
    refetchInterval: 5000,
  });

  const handleCallNext = async () => {
    if (!queue || queue.length === 0) return;

    const nextPatient = queue.find(q => q.status === "arrived");
    if (!nextPatient) {
      toast({
        title: "Нет пациентов",
        description: "В очереди нет прибывших пациентов",
      });
      return;
    }

    const { error } = await supabase
      .from("appointments_queue")
      .update({
        status: "in_progress",
        called_time: new Date().toISOString(),
      })
      .eq("id", nextPatient.id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось вызвать пациента",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Пациент вызван",
        description: `${(nextPatient.profiles as any)?.full_name || "Пациент"} вызван на приём`,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "arrived") {
      return {
        label: "Прибыл",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    }
    return {
      label: "Ожидает",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    };
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Живая очередь
        </CardTitle>
        {queue && queue.length > 0 && (
          <Button
            onClick={handleCallNext}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            <Bell className="w-4 h-4 mr-2" />
            Вызвать
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full bg-muted" />
            ))}
          </div>
        ) : queue && queue.length > 0 ? (
          <div className="space-y-3">
            {queue.map((item) => {
              const status = getStatusBadge(item.status);
              const patient = item.profiles as any;
              const appointment = item.appointments as any;
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all duration-200",
                    item.status === "arrived"
                      ? "bg-emerald-500/5 border-emerald-500/30 shadow-soft"
                      : "bg-muted/30 border-border/50 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                    "bg-primary/10"
                  )}>
                    <span className="text-primary font-bold">
                      {item.queue_number}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-foreground font-medium text-sm truncate">
                        {patient?.full_name || "Пациент"}
                      </span>
                      <Badge variant="outline" className={cn("text-xs", status.className)}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {appointment?.service || "Консультация"}
                      {item.arrival_time && (
                        <span className="ml-1">
                          • {format(new Date(item.arrival_time), "HH:mm", { locale: ru })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Очередь пуста</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
