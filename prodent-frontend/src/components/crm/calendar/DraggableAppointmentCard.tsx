import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { Clock, Check, X, GripVertical, UserCheck, Building2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import { 
  AppointmentData, 
  getStatusStyle, 
  APPOINTMENT_STATUSES, 
  AppointmentStatus,
  PERSONAL_PATIENT_STYLE,
  CLINIC_PATIENT_STYLE,
  GUEST_PATIENT_STYLE
} from "./appointmentConstants";
import { cn } from "@/lib/utils";

interface DraggableAppointmentCardProps {
  appointment: AppointmentData;
  onUpdate: () => void;
  onClick?: () => void;
  compact?: boolean;
}

export const DraggableAppointmentCard = ({ 
  appointment, 
  onUpdate, 
  onClick,
  compact = false 
}: DraggableAppointmentCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: appointment,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
  } : undefined;

  const statusStyle = getStatusStyle(appointment.status);

  const updateStatus = async (newStatus: AppointmentStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointment.id);

      if (error) throw error;

      const statusLabel = APPOINTMENT_STATUSES[newStatus]?.label || newStatus;
      await supabase.from("notifications").insert({
        user_id: appointment.patient_id,
        type: "internal",
        title: "Изменение статуса записи",
        message: `Статус вашей записи изменён на: ${statusLabel}`,
        metadata: { appointment_id: appointment.id },
      });

      toast.success("Статус обновлён");
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Ошибка обновления статуса");
    }
  };

  const patientStyle = appointment.isPersonalPatient ? PERSONAL_PATIENT_STYLE : CLINIC_PATIENT_STYLE;
  const isPersonal = appointment.isPersonalPatient;
  const isGuest = !!appointment.guest_patient_id;
  const patientName = appointment.guest_patients?.name || appointment.profiles?.full_name || "Пациент";

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "p-2 rounded border-l-4 cursor-pointer hover:shadow-md transition-all group relative",
          isGuest 
            ? "bg-slate-50 dark:bg-slate-900/50 border-slate-400"
            : isPersonal 
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500" 
              : statusStyle.bgColor,
          !isPersonal && !isGuest && statusStyle.borderColor,
          statusStyle.color,
          isDragging && "opacity-50 shadow-lg"
        )}
        onClick={onClick}
      >
        {isGuest && (
          <div className="absolute -top-1 -right-1">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-slate-400">
              <UserX className="h-2 w-2 text-white" />
            </span>
          </div>
        )}
        {isPersonal && !isGuest && (
          <div className="absolute -top-1 -right-1">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>
        )}
        <div className="flex items-start gap-1">
          <div
            {...listeners}
            {...attributes}
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate flex items-center gap-1">
              {isGuest && <UserX className="h-3 w-3 text-slate-500 flex-shrink-0" />}
              {isPersonal && !isGuest && <UserCheck className="h-3 w-3 text-amber-500 flex-shrink-0" />}
              {patientName}
            </div>
            <div className="text-xs opacity-75">
              {format(new Date(appointment.appointment_date), "HH:mm")}
            </div>
            {isGuest && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Гость
              </div>
            )}
            {isPersonal && !isGuest && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                Вне кассы
              </div>
            )}
          </div>
        </div>
        {(appointment.status === "pending" || appointment.status === "confirmed") && (
          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {appointment.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0"
                onClick={(e) => updateStatus("confirmed", e)}
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0"
              onClick={(e) => updateStatus("cancelled", e)}
            >
              <X className="h-3 w-3 text-red-600" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-all group relative",
        isGuest 
          ? "bg-slate-50 dark:bg-slate-900/50 border-slate-400"
          : isPersonal 
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500" 
            : statusStyle.bgColor,
        !isPersonal && !isGuest && statusStyle.borderColor,
        statusStyle.color,
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={onClick}
    >
      {isGuest && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-400">
            <UserX className="h-2.5 w-2.5 text-white" />
          </span>
        </div>
      )}
      {isPersonal && !isGuest && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center">
              <UserCheck className="h-2.5 w-2.5 text-white" />
            </span>
          </span>
        </div>
      )}
      <div className="flex items-start gap-2">
        <div
          {...listeners}
          {...attributes}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab mt-1"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate flex items-center gap-1.5">
                {isGuest ? (
                  <UserX className="h-4 w-4 text-slate-500 flex-shrink-0" />
                ) : isPersonal ? (
                  <UserCheck className="h-4 w-4 text-amber-500 flex-shrink-0" />
                ) : (
                  <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                {patientName}
              </div>
              <div className="text-sm opacity-75 truncate">{appointment.service}</div>
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="flex items-center gap-1 opacity-75">
                  <Clock className="h-3 w-3" />
                  {format(new Date(appointment.appointment_date), "HH:mm")}
                </span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    isGuest 
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300" 
                      : isPersonal 
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" 
                        : "bg-primary/10 text-primary border-primary/30"
                  )}
                >
                  {isGuest ? "Гость" : isPersonal ? "Вне кассы" : "Клиника"}
                </Badge>
              </div>
            </div>
            {(appointment.status === "pending" || appointment.status === "confirmed") && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {appointment.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={(e) => updateStatus("confirmed", e)}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={(e) => updateStatus("cancelled", e)}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
