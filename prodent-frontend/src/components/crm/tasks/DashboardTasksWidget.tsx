import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { TaskCard, TaskData } from "./TaskCard";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function DashboardTasksWidget() {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["dashboard-tasks", currentClinic?.id, user?.id],
    queryFn: async () => {
      if (!currentClinic?.id || !user?.id) return [];
      const { data } = await supabase
        .from("clinic_tasks")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("assigned_to", user.id)
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["clinic-tasks"] });
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Мои задачи</h3>
          {tasks && tasks.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {tasks.length}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
          <Link to="/crm/tasks">
            Все задачи <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : tasks && tasks.length > 0 ? (
        <div className="space-y-2">
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
        <p className="text-sm text-muted-foreground text-center py-6">
          Нет активных задач 🎉
        </p>
      )}
    </div>
  );
}
