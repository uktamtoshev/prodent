import { Clock, User, AlertTriangle, CheckCircle2, Circle, Loader2, X, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

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

const priorityConfig = {
  low: { label: "Низкий", color: "bg-muted text-muted-foreground" },
  medium: { label: "Средний", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "Высокий", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  urgent: { label: "Срочный", color: "bg-destructive/10 text-destructive" },
};

const statusConfig = {
  todo: { label: "К выполнению", icon: Circle, color: "text-muted-foreground" },
  in_progress: { label: "В работе", icon: Loader2, color: "text-blue-500" },
  done: { label: "Выполнено", icon: CheckCircle2, color: "text-emerald-500" },
  cancelled: { label: "Отменено", icon: X, color: "text-destructive" },
};

interface TaskCardProps {
  task: TaskData;
  onStatusChange: (taskId: string, status: TaskData["status"]) => void;
  currentUserId?: string;
}

export function TaskCard({ task, onStatusChange, currentUserId }: TaskCardProps) {
  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];
  const StatusIcon = status.icon;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done" && task.status !== "cancelled";

  const nextStatus: Record<string, TaskData["status"]> = {
    todo: "in_progress",
    in_progress: "done",
  };

  return (
    <div className={cn(
      "group rounded-xl border border-border bg-card p-4 transition-all hover:shadow-soft",
      isOverdue && "border-destructive/30",
      task.status === "done" && "opacity-60"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            onClick={() => {
              const next = nextStatus[task.status];
              if (next) onStatusChange(task.id, next);
            }}
            className={cn("mt-0.5 shrink-0", status.color)}
            disabled={task.status === "done" || task.status === "cancelled"}
          >
            <StatusIcon className={cn("w-5 h-5", task.status === "in_progress" && "animate-spin")} />
          </button>
          <div className="min-w-0 flex-1">
            <p className={cn(
              "font-medium text-sm text-foreground",
              task.status === "done" && "line-through"
            )}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priority.color)}>
                {priority.label}
              </Badge>
              {task.due_date && (
                <span className={cn(
                  "flex items-center gap-1 text-[11px]",
                  isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                )}>
                  <CalendarDays className="w-3 h-3" />
                  {format(new Date(task.due_date), "d MMM, HH:mm", { locale: ru })}
                </span>
              )}
              {task.assignee && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <User className="w-3 h-3" />
                  {task.assigned_to === currentUserId ? "Вы" : task.assignee.full_name}
                </span>
              )}
              {task.patient && (
                <span className="text-[11px] text-muted-foreground">
                  → {task.patient.full_name}
                </span>
              )}
            </div>
          </div>
        </div>
        {task.status !== "done" && task.status !== "cancelled" && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.status === "in_progress" && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onStatusChange(task.id, "done")}>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onStatusChange(task.id, "cancelled")}>
              <X className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
