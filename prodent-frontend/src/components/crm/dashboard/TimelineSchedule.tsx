import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, User, ChevronRight } from "lucide-react";
import { format, setHours, setMinutes, isWithinInterval, addMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface TimelineScheduleProps {
  doctorId?: string;
  clinicId?: string;
}

// Working hours configuration
const START_HOUR = 9;
const END_HOUR = 18;
const SLOT_DURATION_MINUTES = 30;

function generateTimeSlots() {
  const slots = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    slots.push({ hour, minute: 0 });
    slots.push({ hour, minute: 30 });
  }
  return slots;
}

export function TimelineSchedule({ doctorId, clinicId }: TimelineScheduleProps) {
  const navigate = useNavigate();
  const timeSlots = generateTimeSlots();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["timeline-appointments", clinicId, doctorId],
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
          notes,
          patient_id,
          profiles:patient_id (
            full_name,
            phone,
            avatar_url
          )
        `)
        .eq("clinic_id", clinicId)
        .gte("appointment_date", today.toISOString())
        .lt("appointment_date", tomorrow.toISOString())
        .order("appointment_date", { ascending: true });

      if (doctorId) {
        query = query.eq("doctor_id", doctorId);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!clinicId,
    refetchInterval: 30000,
  });

  const getStatusConfig = (status: string) => {
    const config: Record<string, { bg: string; border: string; text: string; label: string }> = {
      pending: { 
        bg: "bg-amber-500/10", 
        border: "border-amber-500/30", 
        text: "text-amber-600 dark:text-amber-400",
        label: "Ожидает"
      },
      confirmed: { 
        bg: "bg-blue-500/10", 
        border: "border-blue-500/30", 
        text: "text-blue-600 dark:text-blue-400",
        label: "Подтверждено"
      },
      completed: { 
        bg: "bg-emerald-500/10", 
        border: "border-emerald-500/30", 
        text: "text-emerald-600 dark:text-emerald-400",
        label: "Завершено"
      },
      cancelled: { 
        bg: "bg-red-500/10", 
        border: "border-red-500/30", 
        text: "text-red-600 dark:text-red-400",
        label: "Отменено"
      },
      in_progress: { 
        bg: "bg-primary/10", 
        border: "border-primary/30", 
        text: "text-primary",
        label: "На приёме"
      },
    };
    return config[status] || config.pending;
  };

  const getAppointmentForSlot = (hour: number, minute: number) => {
    if (!appointments) return null;
    
    const slotStart = setMinutes(setHours(new Date(), hour), minute);
    const slotEnd = addMinutes(slotStart, SLOT_DURATION_MINUTES);

    return appointments.find(apt => {
      const aptDate = new Date(apt.appointment_date);
      return isWithinInterval(aptDate, { start: slotStart, end: slotEnd }) ||
             (aptDate >= slotStart && aptDate < slotEnd);
    });
  };

  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Расписание на сегодня
        </CardTitle>
        <button 
          onClick={() => navigate("/crm/schedule")}
          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          Все записи
          <ChevronRight className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-muted" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Timeline header */}
              <div className="flex border-b border-border/50 px-4 py-2 bg-muted/30">
                <div className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                  Время
                </div>
                <div className="flex-1 text-xs font-medium text-muted-foreground">
                  Записи
                </div>
              </div>

              {/* Timeline body */}
              <div className="divide-y divide-border/30">
                {timeSlots.map(({ hour, minute }, index) => {
                  const appointment = getAppointmentForSlot(hour, minute);
                  const isCurrentSlot = hour === currentHour && 
                    ((minute === 0 && currentMinute < 30) || (minute === 30 && currentMinute >= 30));
                  const isPast = hour < currentHour || (hour === currentHour && minute + 30 <= currentMinute);
                  const status = appointment ? getStatusConfig(appointment.status || "pending") : null;
                  const patient = appointment?.profiles as any;

                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-stretch min-h-[52px] transition-colors group",
                        isCurrentSlot && "bg-primary/5",
                        isPast && !appointment && "opacity-50"
                      )}
                    >
                      {/* Time column */}
                      <div className={cn(
                        "w-16 shrink-0 flex items-center px-4 border-r border-border/30",
                        isCurrentSlot && "bg-primary/10"
                      )}>
                        <span className={cn(
                          "text-sm font-medium",
                          isCurrentSlot ? "text-primary" : "text-muted-foreground"
                        )}>
                          {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
                        </span>
                      </div>

                      {/* Content column */}
                      <div className="flex-1 p-2">
                        {appointment ? (
                          <div
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
                              "transition-all duration-200 hover:shadow-soft",
                              status?.bg,
                              status?.border
                            )}
                            onClick={() => navigate(`/crm/patients/${appointment.patient_id}`)}
                          >
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                              {patient?.avatar_url ? (
                                <img 
                                  src={patient.avatar_url} 
                                  alt="" 
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-foreground truncate">
                                  {patient?.full_name || "Пациент"}
                                </span>
                                <Badge variant="outline" className={cn("text-[10px] px-1.5", status?.text)}>
                                  {status?.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {appointment.service}
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(appointment.appointment_date), "HH:mm")}
                            </div>
                          </div>
                        ) : (
                          <div className={cn(
                            "h-full min-h-[36px] rounded-lg border-2 border-dashed border-transparent",
                            "group-hover:border-border/50 transition-colors"
                          )} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
