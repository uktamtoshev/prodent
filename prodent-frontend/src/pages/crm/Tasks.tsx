import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  clearPersistentClientRequestId,
  createClinicTask,
  deleteClinicTask,
  getPersistentClientRequestId,
  listClinicTasks,
  updateClinicTask,
} from "@/lib/crm-operations-api";

/** Вкладки задач из макета. Ключ используется и для среза, и для счётчика. */
const TASK_TABS = [
  { key: "all", ru: "Все", uz: "Barchasi" },
  { key: "today", ru: "На сегодня", uz: "Bugunga" },
  { key: "overdue", ru: "Просрочено", uz: "Muddati oʻtgan" },
  { key: "done", ru: "Выполнено", uz: "Bajarilgan" },
] as const;

type TaskTab = (typeof TASK_TABS)[number]["key"];

interface TaskRow {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  assigned_to?: string | null;
  due_date?: string | null;
  version: number;
  assignee_name?: string | null;
}

/**
 * Приводит срок задачи к календарной дате ГГГГ-ММ-ДД.
 *
 * Сервер отдаёт срок меткой времени, а срез «На сегодня» сравнивает даты.
 * Берём первые десять символов, а НЕ разбираем в Date: разбор сместил бы
 * дату на сутки для часовых поясов западнее нуля («2026-08-10T00:00:00Z»
 * в UTC-5 это ещё 9 августа). Срок задачи — календарный день, назначенный
 * человеком, а не момент времени, поэтому сдвигать его нельзя.
 */
export function toCalendarDate(value?: string | null): string | null {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString("en-CA");
}

export default function Tasks() {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const uz = language === "uz";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [taskTab, setTaskTab] = useState<TaskTab>("all");
  const key = ["s7-clinic-tasks", currentClinic?.id];
  const tasks = useQuery({
    queryKey: key,
    queryFn: () => listClinicTasks(currentClinic!.id) as Promise<TaskRow[]>,
    enabled: !!currentClinic?.id,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });

  /**
   * Срезы задач по макету. Считаются на клиенте из полей, которые уже приходят
   * в списке: срок и статус.
   *
   * Сравнение идёт строками ГГГГ-ММ-ДД, но срок с сервера приходит МЕТКОЙ
   * ВРЕМЕНИ («2026-08-10T14:30:00Z»), поэтому его сначала приводит к
   * календарной дате toCalendarDate. Без этого «На сегодня» не находило
   * ничего никогда: строка со временем не равна строке из десяти символов.
   */
  const todayIso = new Date().toLocaleDateString("en-CA");
  const weekEndIso = (() => {
    const end = new Date();
    end.setDate(end.getDate() + 6);
    return end.toLocaleDateString("en-CA");
  })();

  const allTasks = useMemo(() => tasks.data ?? [], [tasks.data]);

  const matchesTab = useCallback(
    (task: TaskRow, tab: TaskTab) => {
      const done = task.status === "done";
      const due = toCalendarDate(task.due_date);
      if (tab === "all") return true;
      if (tab === "done") return done;
      if (done) return false;
      if (tab === "today") return due === todayIso;
      if (tab === "overdue") return !!due && due < todayIso;
      return false;
    },
    [todayIso],
  );

  const taskCounts = useMemo(() => {
    const counts: Record<TaskTab | "week", number> = {
      all: allTasks.length, today: 0, overdue: 0, done: 0, week: 0,
    };
    for (const task of allTasks) {
      if (task.status === "done") { counts.done += 1; continue; }
      const due = toCalendarDate(task.due_date);
      if (due === todayIso) counts.today += 1;
      if (due && due < todayIso) counts.overdue += 1;
      if (due && due >= todayIso && due <= weekEndIso) counts.week += 1;
    }
    return counts;
  }, [allTasks, todayIso, weekEndIso]);

  const visibleTasks = useMemo(
    () => allTasks.filter((task) => matchesTab(task, taskTab)),
    [allTasks, matchesTab, taskTab],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error(uz ? "Vazifa nomini kiriting" : "Введите название задачи");
      const action = `task-create:${title.trim()}:${priority}`;
      const clientRequestId = getPersistentClientRequestId(user?.id ?? "anonymous", currentClinic!.id, action);
      const result = await createClinicTask(currentClinic!.id, {
        clientRequestId,
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      clearPersistentClientRequestId(user?.id ?? "anonymous", currentClinic!.id, action);
      return result;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      toast.success(uz ? "Vazifa yaratildi" : "Задача создана");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: (task: TaskRow) =>
      updateClinicTask(currentClinic!.id, task.id, {
        expectedVersion: task.version,
        title: task.title,
        description: task.description ?? "",
        priority: task.priority,
        status: task.status === "done" ? "todo" : "done",
        assignedTo: task.assigned_to,
        dueDate: task.due_date,
      }),
    onSuccess: refresh,
    onError: (error: Error) => { toast.error(error.message); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (task: TaskRow) => deleteClinicTask(currentClinic!.id, task.id, task.version),
    onSuccess: refresh,
    onError: (error: Error) => { toast.error(error.message); refresh(); },
  });

  return (
    <CRMLayout>
      <PermissionGate module="tasks">
        <div className="space-y-6 p-4 pb-24 md:p-6 lg:p-8">
          <div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crm.myTasks")}</h1>
            <p className="text-sm text-muted-foreground">{uz ? "Klinika jamoasining vazifalari" : "Задачи команды клиники"}</p>
          </div>
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_160px_auto]">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={uz ? "Vazifa" : "Задача"} />
              <Textarea className="min-h-10" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={uz ? "Izoh" : "Описание"} />
              <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">{uz ? "Past" : "Низкий"}</SelectItem><SelectItem value="normal">{uz ? "Oddiy" : "Обычный"}</SelectItem><SelectItem value="high">{uz ? "Yuqori" : "Высокий"}</SelectItem><SelectItem value="urgent">{uz ? "Shoshilinch" : "Срочный"}</SelectItem></SelectContent></Select>
              <Button disabled={create.isPending} onClick={() => create.mutate()}><Plus className="mr-2 h-4 w-4" />{uz ? "Qo‘shish" : "Добавить"}</Button>
            </CardContent>
          </Card>
          {/* Вкладки и показатели по макету. Считаются из полей, которые уже
              приходят в задаче (due_date + status) — новых запросов не нужно.
              «Выполнено за неделю» из эталона сюда не попало намеренно: у
              задачи нет времени завершения, отличить «сделано вчера» от
              «сделано месяц назад» нечем, а показывать неверное число хуже,
              чем не показывать. */}
          <div className="flex flex-wrap items-center gap-0.5">
            {TASK_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTaskTab(tab.key)}
                aria-pressed={taskTab === tab.key}
                className={cn(
                  "cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  taskTab === tab.key
                    ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {uz ? tab.uz : tab.ru}
                {taskCounts[tab.key] > 0 && (
                  <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                    {taskCounts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-section sm:grid-cols-3">
            {([
              { key: "overdue", ru: "Просрочено", uz: "Muddati oʻtgan", tone: "danger" },
              { key: "today", ru: "На сегодня", uz: "Bugunga", tone: "warning" },
              { key: "week", ru: "На этой неделе", uz: "Shu haftada", tone: "neutral" },
            ] as const).map((kpi) => (
              <Card key={kpi.key}>
                <CardContent className="px-card-x py-3">
                  <p className="text-meta font-medium text-muted-foreground">{uz ? kpi.uz : kpi.ru}</p>
                  <p className="text-kpi tabular-nums text-foreground font-heading">{taskCounts[kpi.key]}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {tasks.isLoading ? <Skeleton className="h-48" /> : tasks.isError ? (
            <Card className="border-destructive/30"><CardContent className="py-12 text-center"><p>{uz ? "Vazifalar yuklanmadi" : "Задачи не загрузились"}</p><Button className="mt-3" variant="outline" onClick={() => void tasks.refetch()}>{uz ? "Qayta urinish" : "Повторить"}</Button></CardContent></Card>
          ) : visibleTasks.length ? (
            <div className="space-y-3">{visibleTasks.map((task) => (
              <Card key={task.id} className={task.status === "done" ? "opacity-65" : ""}>
                <CardContent className="flex items-start gap-3 p-4">
                  <Button size="icon" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(task)} aria-label={uz ? "Holatni o‘zgartirish" : "Изменить статус"}>{task.status === "done" ? <CheckCircle2 className="h-5 w-5 text-status-success" /> : <Circle className="h-5 w-5" />}</Button>
                  <div className="min-w-0 flex-1"><p className={task.status === "done" ? "line-through" : "font-medium"}>{task.title}</p>{task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}<Badge variant="outline" className="mt-2">{task.priority}</Badge></div>
                  <Button size="icon" variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate(task)} aria-label={uz ? "O‘chirish" : "Удалить"}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}</div>
          ) : <Card className="border-dashed"><CardContent className="py-14 text-center text-muted-foreground">{uz ? "Vazifalar yo‘q" : "Задач пока нет"}</CardContent></Card>}
        </div>
      </PermissionGate>
    </CRMLayout>
  );
}
