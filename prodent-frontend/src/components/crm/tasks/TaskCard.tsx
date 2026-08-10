import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Pencil,
  User,
  X,
} from "lucide-react";
import { format, isToday, isTomorrow, isYesterday, differenceInCalendarDays } from "date-fns";
import { ru } from "date-fns/locale";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export interface TaskData {
  id: string;
  title: string;
  description?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "done" | "cancelled";
  due_date?: string | null;
  completed_at?: string | null;
  created_by: string;
  assigned_to: string;
  clinic_id: string;
  related_patient_id?: string | null;
  related_appointment_id?: string | null;
  created_at: string;
  creator?: { full_name: string } | null;
  assignee?: { full_name: string } | null;
  patient?: { full_name: string } | null;
}

interface TaskCardProps {
  task: TaskData;
  onStatusChange: (taskId: string, status: TaskData["status"]) => void;
  onEdit?: (task: TaskData) => void;
  currentUserId?: string;
}

function pluralDay(n: number, t: (k: string) => string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return t("crmTaskCard.daysMany") || "дней";
  if (last === 1) return t("crmTaskCard.dayOne") || "день";
  if (last >= 2 && last <= 4) return t("crmTaskCard.daysFew") || "дня";
  return t("crmTaskCard.daysMany") || "дней";
}

function formatDeadline(
  date: Date,
  t: (k: string) => string,
  isDone: boolean,
): { text: string; tone: "ok" | "warn" | "danger" } {
  const now = new Date();
  const diff = differenceInCalendarDays(date, now);
  const timeStr = format(date, "HH:mm");

  if (isDone) {
    return {
      text: format(date, "d MMM", { locale: ru }),
      tone: "ok",
    };
  }

  if (diff < 0) {
    const overdue = Math.abs(diff);
    return {
      text: `${t("crmTaskCard.overdueBy") || "просрочено на"} ${overdue} ${pluralDay(overdue, t)}`,
      tone: "danger",
    };
  }
  if (isToday(date)) {
    return {
      text: `${t("crmTaskCard.today") || "сегодня"} · ${timeStr}`,
      tone: "warn",
    };
  }
  if (isTomorrow(date)) {
    return {
      text: `${t("crmTaskCard.tomorrow") || "завтра"} · ${timeStr}`,
      tone: "warn",
    };
  }
  if (isYesterday(date)) {
    return {
      text: `${t("crmTaskCard.yesterday") || "вчера"} · ${timeStr}`,
      tone: "danger",
    };
  }
  if (diff <= 14) {
    return {
      text: `${t("crmTaskCard.inDays") || "через"} ${diff} ${pluralDay(diff, t)} · ${timeStr}`,
      tone: "ok",
    };
  }
  return { text: format(date, "d MMM, HH:mm", { locale: ru }), tone: "ok" };
}

export function TaskCard({
  task,
  onStatusChange,
  onEdit,
  currentUserId,
}: TaskCardProps) {
  const { t } = useLanguage();
  const priorityConfig = useMemo(
    () => ({
      low: {
        label: t("crmTaskCreate.priorityLow"),
        color: "bg-muted text-muted-foreground",
      },
      medium: {
        label: t("crmTaskCreate.priorityMedium"),
        color: "border-primary/30 bg-primary/10 text-foreground",
      },
      high: {
        label: t("crmTaskCreate.priorityHigh"),
        color:
          "border-warning-amber/30 bg-warning-amber/10 text-foreground",
      },
      urgent: {
        label: t("crmTaskCreate.priorityUrgent"),
        color: "border-destructive/30 bg-destructive/10 text-destructive",
      },
    }),
    [t],
  );

  const statusConfig = useMemo(
    () => ({
      todo: {
        label: t("crmTaskCreate.statusTodo"),
        icon: Circle,
        color: "text-muted-foreground",
      },
      in_progress: {
        label: t("crmTaskCreate.statusInProgress"),
        icon: Loader2,
        color: "text-primary",
      },
      done: {
        label: t("crmTaskCreate.statusDone"),
        icon: CheckCircle2,
        color: "text-success-green",
      },
      cancelled: {
        label: t("crmTaskCreate.statusCancelled"),
        icon: X,
        color: "text-destructive",
      },
    }),
    [t],
  );

  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];
  const StatusIcon = status.icon;
  const isFinished = task.status === "done" || task.status === "cancelled";
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const deadline = dueDate ? formatDeadline(dueDate, t, isFinished) : null;

  const nextStatus: Record<string, TaskData["status"]> = {
    todo: "in_progress",
    in_progress: "done",
  };

  const openEdit = () => onEdit?.(task);

  return (
    <div
      className={cn(
        "group rounded-panel border border-border bg-card p-4 transition-all",
        onEdit && "cursor-pointer hover:border-foreground/20 hover:shadow-soft",
        deadline?.tone === "danger" && "border-destructive/30",
        task.status === "done" && "opacity-60",
      )}
      onClick={onEdit ? openEdit : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const next = nextStatus[task.status];
              if (next) onStatusChange(task.id, next);
            }}
            className={cn(
              "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
              status.color,
            )}
            disabled={isFinished}
            aria-label={status.label}
          >
            <StatusIcon
              aria-hidden="true"
              className={cn(
                "h-5 w-5",
                task.status === "in_progress" && "animate-spin",
              )}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-sm font-medium text-foreground",
                task.status === "done" && "line-through",
              )}
            >
              {task.title}
            </p>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {task.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("px-1.5 py-0 text-xs", priority.color)}
              >
                {priority.label}
              </Badge>
              {deadline && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    deadline.tone === "danger" &&
                      "font-medium text-destructive",
                    deadline.tone === "warn" &&
                      "font-medium text-warning-amber",
                    deadline.tone === "ok" && "text-muted-foreground",
                  )}
                >
                  <CalendarDays aria-hidden="true" className="h-3 w-3" />
                  {deadline.text}
                </span>
              )}
              {task.assignee && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User aria-hidden="true" className="h-3 w-3" />
                  {task.assigned_to === currentUserId
                    ? t("crmTaskCreate.assigneeMe")
                    : task.assignee.full_name}
                </span>
              )}
              {task.patient && (
                <span className="text-xs text-muted-foreground">
                  → {task.patient.full_name}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/70">
                <Clock aria-hidden="true" className="h-3 w-3" />
                {format(new Date(task.created_at), "d MMM", { locale: ru })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!isFinished && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 gap-1.5 border-success-green/30 text-success-green hover:border-success-green/50 hover:bg-success-green/10 hover:text-success-green"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.id, "done");
              }}
              title={t("crmTaskCreate.statusDone")}
              aria-label={t("crmTaskCreate.statusDone")}
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              <span className="hidden text-xs sm:inline">
                {t("crmTaskCard.complete") || t("crmTaskCreate.statusDone")}
              </span>
            </Button>
          )}
          <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {onEdit && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-11 w-11"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit();
                }}
                title={t("crmTaskCreate.editTask") || "Редактировать"}
                aria-label={t("crmTaskCreate.editTask") || "Редактировать"}
              >
                <Pencil aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
            {!isFinished && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-11 w-11"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(task.id, "cancelled");
                }}
                title={t("crmTaskCreate.statusCancelled")}
                aria-label={t("crmTaskCreate.statusCancelled")}
              >
                <X
                  aria-hidden="true"
                  className="h-4 w-4 text-destructive"
                />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
