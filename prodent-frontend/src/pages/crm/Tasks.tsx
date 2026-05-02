import { useState } from "react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Filter } from "lucide-react";
import { TaskCard, TaskData } from "@/components/crm/tasks/TaskCard";
import { CreateTaskDialog } from "@/components/crm/tasks/CreateTaskDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ViewFilter = "my" | "assigned" | "all";

export default function Tasks() {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("my");
  const [statusFilter, setStatusFilter] = useState("active");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["clinic-tasks", currentClinic?.id, viewFilter, statusFilter, priorityFilter],
    queryFn: async () => {
      if (!currentClinic?.id || !user?.id) return [];
      let query = supabase
        .from("clinic_tasks")
        .select("*, patient:related_patient_id(full_name)")
        .eq("clinic_id", currentClinic.id)
        .order("created_at", { ascending: false });

      if (viewFilter === "my") query = query.eq("assigned_to", user.id);
      else if (viewFilter === "assigned") query = query.eq("created_by", user.id).neq("assigned_to", user.id);

      if (statusFilter === "active") query = query.in("status", ["todo", "in_progress"] as any);
      else if (statusFilter !== "all") query = query.eq("status", statusFilter as any);

      if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as any);

      const { data } = await query.limit(100);
      return (data || []) as unknown as TaskData[];
    },
    enabled: !!currentClinic?.id && !!user?.id,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "done") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("clinic_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
    },
  });

  const activeTasks = tasks?.filter((t) => t.status === "todo" || t.status === "in_progress") || [];
  const doneTasks = tasks?.filter((t) => t.status === "done" || t.status === "cancelled") || [];

  return (
    <CRMLayout>
      <PermissionGate module="tasks">
      <div className="p-4 lg:p-6 xl:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Задачи</h1>
            <p className="text-muted-foreground text-sm mt-1">Управление задачами команды</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Новая задача
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Tabs value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
            <TabsList>
              <TabsTrigger value="my">Мои задачи</TabsTrigger>
              <TabsTrigger value="assigned">Назначенные мной</TabsTrigger>
              <TabsTrigger value="all">Все</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2 ml-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Активные</SelectItem>
                <SelectItem value="todo">К выполнению</SelectItem>
                <SelectItem value="in_progress">В работе</SelectItem>
                <SelectItem value="done">Выполненные</SelectItem>
                <SelectItem value="all">Все статусы</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все приоритеты</SelectItem>
                <SelectItem value="urgent">Срочный</SelectItem>
                <SelectItem value="high">Высокий</SelectItem>
                <SelectItem value="medium">Средний</SelectItem>
                <SelectItem value="low">Низкий</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id}
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Задач пока нет</p>
            <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
              Создать первую задачу
            </Button>
          </div>
        )}

        <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
      </PermissionGate>
    </CRMLayout>
  );
}
