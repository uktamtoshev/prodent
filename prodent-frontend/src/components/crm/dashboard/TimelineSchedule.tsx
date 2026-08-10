import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodayAppointments } from "@/hooks/useTodayAppointments";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, User, ChevronRight } from "lucide-react";
import { format, setHours, setMinutes, isWithinInterval, addMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimelineScheduleProps {
  doctorId?: string;
  clinicId?: string;
}

interface TimelineProfile {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
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
  const { t } = useLanguage();
  const navigate = useNavigate();
  const timeSlots = generateTimeSlots();

  // Запрос вынесен в общий хук: те же записи считает «Главная» для чисел
  // «Завершено» и «Не подтвердили». Ключ общий, поэтому запрос один на двоих.
  const { appointments, isLoading } = useTodayAppointments(clinicId, doctorId);

  const getStatusConfig = (status: string) => {
    const config: Record<string, { bg: string; border: string; text: string; label: string }> = {
      pending: {
        bg: "bg-status-warning/10",
        border: "border-status-warning/30",
        text: "text-status-warning",
        label: t('crmTimelineSchedule.stPending')
      },
      confirmed: {
        bg: "bg-status-info/10",
        border: "border-status-info/30",
        text: "text-status-info",
        label: t('crmTimelineSchedule.stConfirmed')
      },
      completed: {
        bg: "bg-status-success/10",
        border: "border-status-success/30",
        text: "text-status-success",
        label: t('crmTimelineSchedule.stCompleted')
      },
      cancelled: {
        bg: "bg-status-danger/10",
        border: "border-status-danger/30",
        text: "text-status-danger",
        label: t('crmTimelineSchedule.stCancelled')
      },
      in_progress: {
        bg: "bg-primary/10",
        border: "border-primary/30",
        text: "text-primary",
        label: t('crmTimelineSchedule.stInProgress')
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
      {/* Шапка панели по макету: 11px/14px, заголовок 14px/700, снизу граница.
          Было p-6 и заголовок 20px — шапка занимала больше места, чем две
          строки расписания под ней. */}
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
          <Clock className="h-4 w-4 text-primary" />
          {t('crmTimelineSchedule.todaySchedule')}
        </CardTitle>
        <button
          onClick={() => navigate("/crm/schedule")}
          className="cabinet-control flex items-center gap-1 text-meta font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          {t('crmTimelineSchedule.allAppts')}
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
              {/* Шапка списка — как шапка таблицы: 36px на своей поверхности,
                  12px/600. Отличает заголовки столбцов от самих строк. */}
              <div className="flex h-row-head items-center border-b border-border/50 bg-surface-2 px-card-x">
                <div className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">
                  {t('crmTimelineSchedule.timeHeader')}
                </div>
                <div className="flex-1 text-xs font-semibold text-muted-foreground">
                  {t('crmTimelineSchedule.apptsHeader')}
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
                  const patient = appointment?.profiles as TimelineProfile | null;

                  return (
                    <div
                      key={index}
                      className={cn(
                        // 42px по макету. Было min-h-[52px], а с отступом
                        // содержимого строка вырастала до 59px — замерено живьём.
                        "group flex min-h-row items-stretch transition-colors",
                        isCurrentSlot && "bg-primary/5",
                        isPast && !appointment && "opacity-50"
                      )}
                    >
                      {/* Time column */}
                      <div className={cn(
                        "w-16 shrink-0 flex items-center px-card-x border-r border-border/30",
                        isCurrentSlot && "bg-primary/10"
                      )}>
                        <span className={cn(
                          "text-cell font-medium",
                          isCurrentSlot ? "text-primary" : "text-muted-foreground"
                        )}>
                          {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
                        </span>
                      </div>

                      {/* Content column */}
                      {/* Пустой слот не должен добавлять высоты: отступ только
                          по горизонтали, иначе 42px превращаются в 58px. */}
                      <div className="flex flex-1 items-center px-card-x py-0">
                        {appointment ? (
                          <div
                            className={cn(
                              // Плашка записи живёт ВНУТРИ строки 42px, поэтому
                              // отступ ужат: с p-3 (12px) плюс аватар 36px
                              // строка вырастала вдвое.
                              "flex w-full items-center gap-2 rounded-field border px-2 py-1 cursor-pointer",
                              "transition-all duration-200 hover:shadow-soft",
                              status?.bg,
                              status?.border
                            )}
                            onClick={() => navigate(`/crm/patients/${appointment.patient_id}`)}
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
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
                                  {patient?.full_name || t('crmTimelineSchedule.patientFallback')}
                                </span>
                                <Badge variant="outline" className={cn("text-xs px-1.5", status?.text)}>
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
