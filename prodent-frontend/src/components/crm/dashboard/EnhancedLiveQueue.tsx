import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock, Play, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CrmApiError,
  clearPersistentClientRequestId,
  getClinicQueue,
  getPersistentClientRequestId,
  queueCommand,
  type QueueAction,
} from "@/lib/crm-operations-api";

interface EnhancedLiveQueueProps {
  doctorId?: string;
  clinicId?: string;
}

interface QueueRow {
  id: string;
  appointment_id: string;
  queue_number: number;
  status: "WAITING" | "CALLED" | "IN_SERVICE" | "COMPLETED" | "CANCELLED";
  patient_name: string;
  appointment_start_time?: string | null;
  version: number;
}

const nextAction = (status: QueueRow["status"]): QueueAction | null => {
  if (status === "WAITING") return "call";
  if (status === "CALLED") return "start";
  if (status === "IN_SERVICE") return "complete";
  return null;
};

export function EnhancedLiveQueue({ clinicId }: EnhancedLiveQueueProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const date = new Date().toLocaleDateString("en-CA");
  const uz = language === "uz";
  const key = ["s7-clinic-queue", clinicId, date];

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => getClinicQueue(clinicId!, date) as Promise<QueueRow[]>,
    enabled: !!clinicId,
    refetchInterval: 5_000,
  });

  const command = useMutation({
    mutationFn: async ({
      row,
      action,
    }: {
      row: QueueRow;
      action: QueueAction;
    }) => {
      const actionKey = `queue:${row.id}:${action}:v${row.version}`;
      const clientRequestId = getPersistentClientRequestId(
        user?.id ?? "anonymous",
        clinicId!,
        actionKey,
      );
      const result = await queueCommand(clinicId!, action, {
        clientRequestId,
        queueEntryId: row.id,
        expectedVersion: row.version,
      });
      clearPersistentClientRequestId(
        user?.id ?? "anonymous",
        clinicId!,
        actionKey,
      );
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success(uz ? "Navbat yangilandi" : "Очередь обновлена");
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof CrmApiError && error.status === 409
          ? uz
            ? "Navbat allaqachon o‘zgargan. Ro‘yxat yangilandi."
            : "Очередь уже изменилась. Список обновлён."
          : error.message,
      );
      void refetch();
    },
  });

  return (
    <Card className="h-full border-border/50 bg-card/80 shadow-soft">
      {/* Шапка панели по макету: 11px/14px, заголовок 14px/700, снизу граница —
          та же форма, что у расписания рядом. */}
      <CardHeader className="border-b border-border/50 px-card-x py-card-y">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Users className="h-4 w-4 text-primary" />
          {uz ? "Jonli navbat" : "Живая очередь"}
          <Badge variant="secondary" className="ml-auto">
            {data.filter((row) => row.status !== "COMPLETED").length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-card-x">
        {isLoading ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 p-4 text-sm">
            <p>{uz ? "Navbat yuklanmadi" : "Очередь не загрузилась"}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>
              {uz ? "Qayta urinish" : "Повторить"}
            </Button>
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Activity className="mx-auto mb-3 h-8 w-8" />
            {uz ? "Bugun navbat bo‘sh" : "Сегодня очередь пуста"}
          </div>
        ) : (
          data.map((row) => {
            const action = nextAction(row.status);
            const Icon =
              row.status === "IN_SERVICE"
                ? Play
                : row.status === "COMPLETED"
                  ? CheckCircle2
                  : Clock;
            const actionLabel =
              action === "call"
                ? uz ? "Chaqirish" : "Вызвать"
                : action === "start"
                  ? uz ? "Boshlash" : "Начать"
                  : uz ? "Yakunlash" : "Завершить";
            return (
              <div key={row.id} className="rounded-xl border bg-background/70 p-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                    {row.queue_number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.patient_name || "—"}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {row.status}
                    </p>
                  </div>
                  {action && (
                    <Button
                      size="sm"
                      disabled={command.isPending}
                      onClick={() => command.mutate({ row, action })}
                    >
                      {actionLabel}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
