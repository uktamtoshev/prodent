import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Clock, UserCheck, Building2, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppointmentData, APPOINTMENT_STATUSES, AppointmentStatus } from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";

interface AppointmentListItemProps {
  appointment: AppointmentData;
  onClick: () => void;
  onStatusChange: (appointmentId: string, status: AppointmentStatus) => void;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  confirmed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  pending: "bg-blue-500",
  confirmed: "bg-indigo-500",
  completed: "bg-green-500",
  cancelled: "bg-red-500",
};

export const AppointmentListItem = ({ 
  appointment, 
  onClick, 
  onStatusChange,
  compact = false 
}: AppointmentListItemProps) => {
  const isPersonal = appointment.isPersonalPatient;
  const status = appointment.status as AppointmentStatus;
  const statusConfig = APPOINTMENT_STATUSES[status] || APPOINTMENT_STATUSES.pending;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "group relative p-2.5 rounded-lg border cursor-pointer transition-all",
          "hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600",
          "bg-white dark:bg-neutral-800",
          "border-l-4",
          {
            "border-l-blue-500": status === "pending",
            "border-l-indigo-500": status === "confirmed",
            "border-l-green-500": status === "completed",
            "border-l-red-500": status === "cancelled",
          },
          isPersonal && "ring-1 ring-amber-200 dark:ring-amber-800"
        )}
      >
        {isPersonal && (
          <div className="absolute -top-1 -right-1 h-3 w-3 bg-amber-500 rounded-full" />
        )}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isPersonal && <UserCheck className="h-3 w-3 text-amber-500 shrink-0" />}
              <span className="text-sm font-medium truncate">
                {appointment.profiles?.full_name || "Пациент"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(appointment.appointment_date), "HH:mm")}
            </div>
          </div>
          <div className={cn("w-2 h-2 rounded-full mt-1.5", STATUS_DOT_COLORS[status])} />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative p-4 rounded-xl border cursor-pointer transition-all",
        "hover:shadow-lg hover:border-neutral-300 dark:hover:border-neutral-600",
        "bg-white dark:bg-neutral-800",
        "border-neutral-200 dark:border-neutral-700",
        isPersonal && "ring-1 ring-amber-200 dark:ring-amber-800"
      )}
    >
      {isPersonal && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center">
              <UserCheck className="h-2.5 w-2.5 text-white" />
            </span>
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isPersonal ? (
              <UserCheck className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <Building2 className="h-4 w-4 text-neutral-500 shrink-0" />
            )}
            <span className="font-medium text-foreground truncate">
              {appointment.profiles?.full_name || "Пациент"}
            </span>
          </div>

          <div className="text-sm text-muted-foreground mt-1 truncate">
            {appointment.service}
          </div>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {format(new Date(appointment.appointment_date), "HH:mm")}
            </div>
            
            <Badge 
              variant="outline" 
              className={cn("text-[10px] font-medium", STATUS_COLORS[status])}
            >
              {statusConfig.label}
            </Badge>

            {isPersonal && (
              <Badge 
                variant="outline" 
                className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
              >
                Вне кассы
              </Badge>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {Object.entries(APPOINTMENT_STATUSES)
              .filter(([key]) => key !== status)
              .map(([key, value]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onStatusChange(appointment.id, key as AppointmentStatus)}
                >
                  <div className={cn("w-2 h-2 rounded-full mr-2", STATUS_DOT_COLORS[key])} />
                  {value.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
