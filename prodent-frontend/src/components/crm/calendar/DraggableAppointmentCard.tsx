import { useDraggable } from "@dnd-kit/core";
import { Clock, Check, X, GripVertical, UserCheck, Building2, UserX } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  AppointmentData, 
  APPOINTMENT_STATUSES,
  getStatusStyle, 
  AppointmentStatus,
  getAppointmentTime,
  normalizeAppointmentStatus,
} from "./appointmentConstants";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { setAppointmentStatus } from "@/lib/appointment-api";

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
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: appointment,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
  } : undefined;

  const statusStyle = getStatusStyle(appointment.status);
  const normalizedStatus = normalizeAppointmentStatus(appointment.status);

  const updateStatus = async (newStatus: AppointmentStatus, e: MouseEvent) => {
    e.stopPropagation();
    try {
      await setAppointmentStatus({ appointmentId: appointment.id, status: newStatus });

      toast.success(t('crmStatusDropdown.statusChanged'));
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(t('crmStatusDropdown.statusError'));
    }
  };

  const isPersonal = appointment.isPersonalPatient;
  const isGuest = !!appointment.guest_patient_id;
  const patientName = appointment.guest_patients?.name || appointment.profiles?.full_name || t('crmStatusDropdown.patientFallback');

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative rounded border-l-4 p-2 transition-all hover:shadow-md",
          isGuest 
            ? "border-muted-foreground/40 bg-muted text-foreground"
            : isPersonal 
              ? "border-warning-amber bg-warning-amber/10 text-foreground"
              : statusStyle.bgColor,
          !isPersonal && !isGuest && statusStyle.borderColor,
          statusStyle.color,
          isDragging && "opacity-50 shadow-lg"
        )}
        onClick={onClick}
      >
        {isGuest && (
          <div className="absolute -top-1 -right-1">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-muted-foreground">
              <UserX
                aria-hidden="true"
                className="h-2 w-2 text-background"
              />
            </span>
          </div>
        )}
        {isPersonal && !isGuest && (
          <div className="absolute -top-1 -right-1">
            <span className="flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-amber opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-warning-amber" />
            </span>
          </div>
        )}
        <div className="flex items-start gap-1">
          <button
            {...listeners}
            {...attributes}
            type="button"
            aria-label={`${patientName}: ${getAppointmentTime(appointment)}`}
            className="flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-md opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical
              aria-hidden="true"
              className="h-4 w-4 text-muted-foreground"
            />
          </button>
          <button
            type="button"
            className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={patientName}
            onClick={(event) => {
              event.stopPropagation();
              onClick?.();
            }}
          >
            <div className="text-xs font-medium truncate flex items-center gap-1">
              {isGuest && (
                <UserX
                  aria-hidden="true"
                  className="h-3 w-3 flex-shrink-0 text-muted-foreground"
                />
              )}
              {isPersonal && !isGuest && (
                <UserCheck
                  aria-hidden="true"
                  className="h-3 w-3 flex-shrink-0 text-warning-amber"
                />
              )}
              {patientName}
            </div>
            <div className="text-xs opacity-75">
              {getAppointmentTime(appointment)}
            </div>
            {isGuest && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t('crmStatusDropdown.guest')}
              </div>
            )}
            {isPersonal && !isGuest && (
              <div className="mt-0.5 text-xs text-foreground">
                {t('crmStatusDropdown.offCash')}
              </div>
            )}
          </button>
        </div>
        {(normalizedStatus === "pending" || normalizedStatus === "confirmed") && (
          <div className="mt-1 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {normalizedStatus === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-11 w-11 p-0"
                aria-label={APPOINTMENT_STATUSES.confirmed.label}
                onClick={(e) => updateStatus("confirmed", e)}
              >
                <Check
                  aria-hidden="true"
                  className="h-4 w-4 text-success-green"
                />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-11 w-11 p-0"
              aria-label={APPOINTMENT_STATUSES.cancelled.label}
              onClick={(e) => updateStatus("cancelled", e)}
            >
              <X aria-hidden="true" className="h-4 w-4 text-destructive" />
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
        "group relative rounded-lg border-l-4 p-3 transition-all hover:shadow-md",
        isGuest 
          ? "border-muted-foreground/40 bg-muted text-foreground"
          : isPersonal 
            ? "border-warning-amber bg-warning-amber/10 text-foreground"
            : statusStyle.bgColor,
        !isPersonal && !isGuest && statusStyle.borderColor,
        statusStyle.color,
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={onClick}
    >
      {isGuest && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground">
            <UserX
              aria-hidden="true"
              className="h-2.5 w-2.5 text-background"
            />
          </span>
        </div>
      )}
      {isPersonal && !isGuest && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-amber opacity-75" />
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning-amber">
              <UserCheck
                aria-hidden="true"
                className="h-2.5 w-2.5 text-primary-foreground"
              />
            </span>
          </span>
        </div>
      )}
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          type="button"
          aria-label={`${patientName}: ${getAppointmentTime(appointment)}`}
          className="mt-1 flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-md opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground"
          />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={patientName}
              onClick={(event) => {
                event.stopPropagation();
                onClick?.();
              }}
            >
              <div className="font-medium truncate flex items-center gap-1.5">
                {isGuest ? (
                  <UserX
                    aria-hidden="true"
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                  />
                ) : isPersonal ? (
                  <UserCheck
                    aria-hidden="true"
                    className="h-4 w-4 flex-shrink-0 text-warning-amber"
                  />
                ) : (
                  <Building2
                    aria-hidden="true"
                    className="h-4 w-4 flex-shrink-0 text-primary"
                  />
                )}
                {patientName}
              </div>
              <div className="text-sm opacity-75 truncate">{appointment.service}</div>
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="flex items-center gap-1 opacity-75">
                  <Clock aria-hidden="true" className="h-3 w-3" />
                  {getAppointmentTime(appointment)}
                </span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "px-1.5 py-0 text-xs",
                    isGuest 
                      ? "border-muted-foreground/30 bg-muted text-foreground"
                      : isPersonal 
                        ? "border-warning-amber/30 bg-warning-amber/10 text-foreground"
                        : "bg-primary/10 text-primary border-primary/30"
                  )}
                >
                  {isGuest ? t('crmStatusDropdown.guest') : isPersonal ? t('crmStatusDropdown.offCash') : t('crmStatusDropdown.clinic')}
                </Badge>
              </div>
            </button>
            {(normalizedStatus === "pending" || normalizedStatus === "confirmed") && (
              <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {normalizedStatus === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-11 w-11 p-0"
                    aria-label={APPOINTMENT_STATUSES.confirmed.label}
                    onClick={(e) => updateStatus("confirmed", e)}
                  >
                    <Check
                      aria-hidden="true"
                      className="h-4 w-4 text-success-green"
                    />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-11 w-11 p-0"
                  aria-label={APPOINTMENT_STATUSES.cancelled.label}
                  onClick={(e) => updateStatus("cancelled", e)}
                >
                  <X
                    aria-hidden="true"
                    className="h-4 w-4 text-destructive"
                  />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
