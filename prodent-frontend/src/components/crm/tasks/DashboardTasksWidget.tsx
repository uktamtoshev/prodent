import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { listClinicTasks, updateClinicTask } from "@/lib/crm-operations-api";
import { TaskCard, type TaskData } from "./TaskCard";

type VersionedTask = TaskData & { version: number };

export function DashboardTasksWidget() {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ["dashboard-tasks", currentClinic?.id, user?.id];
  const tasks = useQuery({
    queryKey: key,
    queryFn: async () => {
      const rows = await listClinicTasks(currentClinic!.id) as VersionedTask[];
      return rows
        .filter((task) => task.assigned_to === user!.id && ["todo", "in_progress"].includes(task.status))
        .slice(0, 5);
    },
    enabled: !!currentClinic?.id && !!user?.id,
  });
  const updateStatus = useMutation({
    mutationFn: ({ task, status }: { task: VersionedTask; status: TaskData["status"] }) =>
      updateClinicTask(currentClinic!.id, task.id, {
        expectedVersion: task.version,
        title: task.title,
        description: task.description ?? "",
        priority: task.priority,
        status,
        assignedTo: task.assigned_to,
        dueDate: task.due_date,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["s7-clinic-tasks"] });
    },
  });
  // Панель по макету: радиус 10px, шапка 11/14 с разделителем, тело 14px.
  // Было rounded-xl и p-5 на всю панель — шапка и содержимое сливались.
  return (
    <div className="rounded-panel border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-card-x py-card-y">
        <h3 className="flex items-center gap-2 text-base font-bold"><CheckSquare className="h-4 w-4 text-primary" />Мои задачи</h3>
        <Button variant="ghost" size="sm" asChild><Link to="/crm/tasks">Все <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
      </div>
      <div className="p-card-x">
      {tasks.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : tasks.data?.length ? (
        <div className="space-y-2">{tasks.data.map((task) => (
          <TaskCard key={task.id} task={task} currentUserId={user?.id}
            onStatusChange={(_, status) => updateStatus.mutate({ task, status })} />
        ))}</div>
      ) : <p className="py-6 text-center text-sm text-muted-foreground">Активных задач нет</p>}
      </div>
    </div>
  );
}
