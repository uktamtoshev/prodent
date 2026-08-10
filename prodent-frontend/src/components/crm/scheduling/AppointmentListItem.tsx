import { Building2, Clock, MoreHorizontal, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AppointmentData,
  APPOINTMENT_STATUSES,
  AppointmentStatus,
  getAppointmentTime,
  normalizeAppointmentStatus,
} from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface AppointmentListItemProps {
  appointment: AppointmentData;
  onClick: () => void;
  onStatusChange: (appointmentId: string, status: AppointmentStatus) => void;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending:
    "border-warning-amber/30 bg-warning-amber/10 text-foreground",
  confirmed: "border-primary/30 bg-primary/10 text-foreground",
  in_progress: "border-foreground/30 bg-foreground/10 text-foreground",
  completed: "border-success-green/30 bg-success-green/10 text-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-foreground",
  no_show: "border-warning-amber/30 bg-warning-amber/10 text-foreground",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  pending: "bg-warning-amber",
  confirmed: "bg-primary",
  in_progress: "bg-foreground",
  completed: "bg-success-green",
  cancelled: "bg-destructive",
  no_show: "bg-warning-amber",
};

export const AppointmentListItem = ({
  appointment,
  onClick,
  onStatusChange,
  compact = false,
}: AppointmentListItemProps) => {
  const { t } = useLanguage();
  const isPersonal = appointment.isPersonalPatient;
  const status = normalizeAppointmentStatus(appointment.status);
  const statusConfig =
    APPOINTMENT_STATUSES[status] || APPOINTMENT_STATUSES.pending;
  const patientName =
    appointment.guest_patients?.name ||
    appointment.profiles?.full_name ||
    t("crmStatusDropdown.patientFallback");
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={patientName}
        className={cn(
          "group relative min-h-11 w-full cursor-pointer rounded-xl border border-l-4 bg-card p-2.5 text-left transition-all hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          {
            "border-l-warning-amber": status === "pending",
            "border-l-primary": status === "confirmed",
            "border-l-foreground": status === "in_progress",
            "border-l-success-green": status === "completed",
            "border-l-destructive": status === "cancelled",
            "border-l-warning-amber": status === "no_show",
          },
          isPersonal && "ring-1 ring-warning-amber/40",
        )}
      >
        {isPersonal && (
          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-warning-amber" />
        )}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isPersonal && (
                <UserCheck
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 text-warning-amber"
                />
              )}
              <span className="truncate text-sm font-medium">
                {patientName}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {getAppointmentTime(appointment)}
            </div>
          </div>
          <div
            aria-hidden="true"
            className={cn(
              "mt-1.5 h-2 w-2 rounded-full",
              STATUS_DOT_COLORS[status],
            )}
          />
        </div>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-panel border border-border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-lg",
        isPersonal && "ring-1 ring-warning-amber/40",
      )}
    >
      {isPersonal && (
        <div className="absolute -right-1 -top-1">
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

      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onClick}
          aria-label={patientName}
          className="min-w-0 flex-1 cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-2">
            {isPersonal ? (
              <UserCheck
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-warning-amber"
              />
            ) : (
              <Building2
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
            )}
            <span className="truncate font-medium text-foreground">
              {patientName}
            </span>
          </div>

          <div className="mt-1 truncate text-sm text-muted-foreground">
            {appointment.service}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock aria-hidden="true" className="h-3 w-3" />
              {getAppointmentTime(appointment)}
            </div>

            <Badge
              variant="outline"
              className={cn("text-xs font-medium", STATUS_COLORS[status])}
            >
              {statusConfig.label}
            </Badge>

            {isPersonal && (
              <Badge
                variant="outline"
                className="border-warning-amber/30 bg-warning-amber/10 text-xs text-foreground"
              >
                {t("crmStatusDropdown.offCash")}
              </Badge>
            )}
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              aria-label={t("crmStatusDropdown.changeStatus")}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {Object.entries(APPOINTMENT_STATUSES)
              .filter(([key]) => key !== status)
              .map(([key, value]) => (
                <DropdownMenuItem
                  key={key}
                  className="min-h-11"
                  onClick={() =>
                    onStatusChange(appointment.id, key as AppointmentStatus)
                  }
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      "mr-2 h-2 w-2 rounded-full",
                      STATUS_DOT_COLORS[key],
                    )}
                  />
                  {value.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
