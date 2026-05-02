import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Bell, 
  Clock, 
  Play, 
  CheckCircle2, 
  MapPin,
  ChevronRight,
  Timer
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EnhancedLiveQueueProps {
  doctorId?: string;
  clinicId?: string;
}

type QueueStatus = "waiting" | "arrived" | "in_progress" | "completed";

const statusConfig: Record<QueueStatus, { 
  label: string; 
  bg: string; 
  text: string; 
  icon: typeof Clock;
  next?: QueueStatus;
  nextLabel?: string;
}> = {
  waiting: { 
    label: "Ожидает", 
    bg: "bg-amber-500/10", 
    text: "text-amber-600 dark:text-amber-400",
    icon: Clock,
    next: "arrived",
    nextLabel: "Отметить прибытие"
  },
  arrived: { 
    label: "Прибыл", 
    bg: "bg-blue-500/10", 
    text: "text-blue-600 dark:text-blue-400",
    icon: MapPin,
    next: "in_progress",
    nextLabel: "Начать приём"
  },
  in_progress: { 
    label: "На приёме", 
    bg: "bg-primary/10", 
    text: "text-primary",
    icon: Play,
    next: "completed",
    nextLabel: "Завершить"
  },
  completed: { 
    label: "Завершён", 
    bg: "bg-emerald-500/10", 
    text: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2
  },
};

// Mock rooms - in real app would come from clinic_settings
const rooms = [
  { id: "1", name: "Кабинет 1" },
  { id: "2", name: "Кабинет 2" },
  { id: "3", name: "Кабинет 3" },
];

function WaitingTimer({ arrivalTime }: { arrivalTime: string }) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const mins = differenceInMinutes(new Date(), new Date(arrivalTime));
      setMinutes(Math.max(0, mins));
    };
    
    calculate();
    const interval = setInterval(calculate, 60000);
    return () => clearInterval(interval);
  }, [arrivalTime]);

  return (
    <div className={cn(
      "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
      minutes > 15 
        ? "bg-red-500/10 text-red-600 dark:text-red-400" 
        : minutes > 5 
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-muted text-muted-foreground"
    )}>
      <Timer className="w-3 h-3" />
      {minutes} мин
    </div>
  );
}

export function EnhancedLiveQueue({ doctorId, clinicId }: EnhancedLiveQueueProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: queue, isLoading } = useQuery({
    queryKey: ["enhanced-queue", clinicId, doctorId],
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
            phone,
            avatar_url
          ),
          appointments:appointment_id (
            service,
            appointment_date
          )
        `)
        .eq("clinic_id", clinicId)
        .gte("created_at", today.toISOString())
        .in("status", ["waiting", "arrived", "in_progress"])
        .order("queue_number", { ascending: true });

      if (doctorId) {
        query = query.eq("doctor_id", doctorId);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!clinicId,
    refetchInterval: 5000,
  });

  const updateStatus = async (id: string, newStatus: QueueStatus) => {
    const updates: Record<string, any> = { status: newStatus };
    
    if (newStatus === "arrived") {
      updates.arrival_time = new Date().toISOString();
    } else if (newStatus === "in_progress") {
      updates.called_time = new Date().toISOString();
    } else if (newStatus === "completed") {
      updates.completed_time = new Date().toISOString();
    }

    const { error } = await supabase
      .from("appointments_queue")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive",
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ["enhanced-queue"] });
      toast({
        title: "Статус обновлён",
        description: `Статус изменён на "${statusConfig[newStatus].label}"`,
      });
    }
  };

  const callNextPatient = () => {
    const arrivedPatient = queue?.find(q => q.status === "arrived");
    if (arrivedPatient) {
      updateStatus(arrivedPatient.id, "in_progress");
    } else {
      toast({
        title: "Нет пациентов",
        description: "В очереди нет прибывших пациентов",
      });
    }
  };

  const arrivedCount = queue?.filter(q => q.status === "arrived").length || 0;
  const inProgressCount = queue?.filter(q => q.status === "in_progress").length || 0;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Живая очередь
          </CardTitle>
          <div className="flex items-center gap-2">
            {arrivedCount > 0 && (
              <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                {arrivedCount} прибыло
              </Badge>
            )}
            {inProgressCount > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {inProgressCount} на приёме
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        {/* Call Next Button */}
        {queue && queue.length > 0 && arrivedCount > 0 && (
          <Button
            onClick={callNextPatient}
            className="w-full mb-4 bg-primary hover:bg-primary/90 gap-2"
            size="lg"
          >
            <Bell className="w-4 h-4" />
            Вызвать следующего
          </Button>
        )}

        {/* Queue List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full bg-muted" />
            ))}
          </div>
        ) : queue && queue.length > 0 ? (
          <div className="space-y-3 flex-1 overflow-auto">
            {queue.map((item) => {
              const status = statusConfig[item.status as QueueStatus] || statusConfig.waiting;
              const patient = item.profiles as any;
              const appointment = item.appointments as any;
              const StatusIcon = status.icon;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-4 rounded-xl border transition-all duration-200",
                    status.bg,
                    "border-border/50 hover:shadow-soft"
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                        "bg-primary/10 text-primary"
                      )}>
                        {item.queue_number}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {patient?.full_name || "Пациент"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {appointment?.service || "Консультация"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.arrival_time && item.status !== "completed" && (
                        <WaitingTimer arrivalTime={item.arrival_time} />
                      )}
                      <Badge variant="outline" className={cn("text-xs", status.text)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Time info */}
                  {appointment?.appointment_date && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Запись: {format(new Date(appointment.appointment_date), "HH:mm")}
                      </span>
                      {item.arrival_time && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Прибыл: {format(new Date(item.arrival_time), "HH:mm")}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Room selector for in_progress */}
                    {item.status === "in_progress" && (
                      <Select defaultValue="1">
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue placeholder="Кабинет" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Status change button */}
                    {status.next && (
                      <Button
                        variant={item.status === "arrived" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "flex-1 gap-1 text-xs",
                          item.status === "arrived" && "bg-primary hover:bg-primary/90"
                        )}
                        onClick={() => updateStatus(item.id, status.next!)}
                      >
                        {status.nextLabel}
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Очередь пуста</p>
              <p className="text-xs mt-1">Пациенты появятся после регистрации</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
