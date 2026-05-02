import { CRMLayout } from "@/components/crm/CRMLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useClinic } from "@/contexts/ClinicContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import {
  Clock,
  CheckCircle,
  PlayCircle,
  UserCheck,
  XCircle,
  Hash,
  Users,
  Stethoscope,
} from "lucide-react";
import { useEffect } from "react";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  WAITING: { label: "Ожидает", color: "bg-amber-500/10 text-amber-700 border-amber-500/30", icon: Clock },
  CALLED: { label: "Вызван", color: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: UserCheck },
  IN_PROGRESS: { label: "На приёме", color: "bg-primary/10 text-primary border-primary/30", icon: PlayCircle },
  COMPLETED: { label: "Завершён", color: "bg-green-500/10 text-green-700 border-green-500/30", icon: CheckCircle },
  NO_SHOW: { label: "Не пришёл", color: "bg-red-500/10 text-red-700 border-red-500/30", icon: XCircle },
};

export default function Queue() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: queue, isLoading } = useQuery({
    queryKey: ["clinic-queue", currentClinic?.id, today],
    queryFn: async () => {
      if (!currentClinic?.id) return [] as any[];
      const { data, error } = await supabase
        .from("appointments_queue")
        .select(
          "*, appointment:appointments(id, appointment_date, start_time, end_time, status, " +
            "patient:users!appointments_patient_id_fkey(id, first_name, last_name, phone), " +
            "doctor:doctors(id, user_id, user:users(first_name, last_name)), " +
            "service:services(id, name))"
        )
        .eq("clinic_id", currentClinic.id)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .order("queue_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentClinic?.id,
    refetchInterval: 15000, // refresh every 15s for live queue feel
  });

  // Realtime subscription (will fall back to polling if WS unavailable)
  useEffect(() => {
    if (!currentClinic?.id) return;
    const channel = supabase
      .channel(`queue-${currentClinic.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments_queue", filter: `clinic_id=eq.${currentClinic.id}` },
        () => qc.invalidateQueries({ queryKey: ["clinic-queue", currentClinic.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClinic?.id, qc]);

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: string; extra?: any }) => {
      const patch: any = { status, ...(extra || {}) };
      const { error } = await supabase.from("appointments_queue").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-queue"] });
    },
    onError: (e: any) =>
      toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const stats = {
    waiting: queue?.filter((q: any) => q.status === "WAITING").length ?? 0,
    inProgress: queue?.filter((q: any) => q.status === "IN_PROGRESS").length ?? 0,
    done: queue?.filter((q: any) => q.status === "COMPLETED").length ?? 0,
    total: queue?.length ?? 0,
  };

  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-foreground text-2xl font-bold flex items-center gap-2">
              <Hash className="w-6 h-6 text-primary" />
              Очередь в клинике
            </h1>
            <p className="text-muted-foreground mt-1">
              Живая очередь пациентов на сегодня — обновляется автоматически
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Всего</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Ожидают</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">{stats.waiting}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">На приёме</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{stats.inProgress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Завершены</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.done}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="w-5 h-5" />
              Текущая очередь
            </CardTitle>
            <CardDescription>
              Кликните по статусу, чтобы перевести пациента на следующий шаг
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : !queue || queue.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Очередь пуста</p>
                <p className="text-sm mt-1">Сегодня пациентов в очереди нет.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((q: any) => {
                  const meta = STATUS_META[q.status] || STATUS_META.WAITING;
                  const Icon = meta.icon;
                  const a = q.appointment;
                  return (
                    <div
                      key={q.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 ${meta.color}`}
                    >
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-background border-2 flex items-center justify-center font-bold text-lg">
                        {q.queue_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {a?.patient?.first_name} {a?.patient?.last_name}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          {a?.start_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {a.start_time.slice(0, 5)}
                            </span>
                          )}
                          {a?.doctor?.user && (
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-3 h-3" />
                              {a.doctor.user.first_name} {a.doctor.user.last_name}
                            </span>
                          )}
                          {a?.service?.name && <span className="truncate">{a.service.name}</span>}
                        </div>
                        {q.arrival_time && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Прибыл: {new Date(q.arrival_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1 bg-background">
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </Badge>
                        <div className="flex flex-col gap-1">
                          {q.status === "WAITING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatusMut.mutate({
                                  id: q.id,
                                  status: "CALLED",
                                  extra: { arrival_time: q.arrival_time || new Date().toISOString() },
                                })
                              }
                            >
                              Вызвать
                            </Button>
                          )}
                          {q.status === "CALLED" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateStatusMut.mutate({
                                  id: q.id,
                                  status: "IN_PROGRESS",
                                  extra: { start_time: new Date().toISOString() },
                                })
                              }
                            >
                              На приём
                            </Button>
                          )}
                          {q.status === "IN_PROGRESS" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateStatusMut.mutate({
                                  id: q.id,
                                  status: "COMPLETED",
                                  extra: { completion_time: new Date().toISOString() },
                                })
                              }
                            >
                              Завершить
                            </Button>
                          )}
                          {(q.status === "WAITING" || q.status === "CALLED") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => updateStatusMut.mutate({ id: q.id, status: "NO_SHOW" })}
                            >
                              Не пришёл
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}
