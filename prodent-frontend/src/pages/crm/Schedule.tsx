import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckSquare2, MoveRight, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { DataTable } from "@/components/system/DataTable";
import { getStatusStyle } from "@/components/crm/calendar/appointmentConstants";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CrmApiError,
  bulkAppointments,
  clearPersistentClientRequestId,
  getClinicSchedule,
  getPersistentClientRequestId,
} from "@/lib/crm-operations-api";

const GuestAppointmentModal = lazy(() =>
  import("@/components/crm/appointments/GuestAppointmentModal").then((module) => ({
    default: module.GuestAppointmentModal,
  })),
);

interface AppointmentRow {
  id: string;
  doctor_id?: string | null;
  room_id?: string | null;
  appointment_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  patient_name: string;
  version: number;
}

interface Room {
  id: string;
  name: string;
  chair_code?: string | null;
}

/** Периоды календаря из макета: день, неделя, месяц. */
type CalendarView = "day" | "week" | "month";

export default function Schedule() {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const uz = language === "uz";
  const today = new Date();
  const requestedFrom = searchParams.get("from");
  const requestedTo = searchParams.get("to");
  const [from, setFrom] = useState(requestedFrom || today.toLocaleDateString("en-CA"));
  const inWeek = new Date(today);
  inWeek.setDate(today.getDate() + 6);
  const [to, setTo] = useState(requestedTo || inWeek.toLocaleDateString("en-CA"));
  const [view, setView] = useState<CalendarView>(requestedFrom === requestedTo ? "day" : "week");
  const [doctor, setDoctor] = useState("all");
  const [room, setRoom] = useState("all");
  const [chair, setChair] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newStatus, setNewStatus] = useState("CONFIRMED");
  const [moveDate, setMoveDate] = useState(from);
  const [moveTime, setMoveTime] = useState("09:00");
  const [moveDoctor, setMoveDoctor] = useState("");
  const [moveRoom, setMoveRoom] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const key = ["s7-clinic-schedule", currentClinic?.id, from, to];
  const schedule = useQuery({
    queryKey: key,
    queryFn: () => getClinicSchedule(currentClinic!.id, from, to),
    enabled: !!currentClinic?.id && !!from && !!to,
  });
  const appointments = useMemo(
    () => (schedule.data?.appointments ?? []) as AppointmentRow[],
    [schedule.data?.appointments],
  );
  const rooms = useMemo(
    () => (schedule.data?.rooms ?? []) as Room[],
    [schedule.data?.rooms],
  );
  /**
   * Doctors, named. `getClinicSchedule` returns them alongside the
   * appointments, so no extra request and no shim read is needed — the page was
   * simply throwing the list away and showing `doctor_id.slice(0, 8)`, i.e. a
   * truncated UUID, in the filter and in the reschedule form.
   *
   * Field names are probed defensively: this payload comes from the backend and
   * an unknown shape must degrade to a short id, never crash the schedule.
   */
  const doctorOptions = useMemo(() => {
    const fromPayload = (schedule.data?.doctors ?? []) as Array<Record<string, unknown>>;
    const named = new Map<string, string>();
    for (const entry of fromPayload) {
      const id = typeof entry.id === "string" ? entry.id
        : typeof entry.doctor_id === "string" ? entry.doctor_id
        : null;
      if (!id) continue;
      const profile = entry.profiles as Record<string, unknown> | undefined;
      const name =
        (typeof entry.full_name === "string" && entry.full_name) ||
        (typeof entry.name === "string" && entry.name) ||
        (typeof profile?.full_name === "string" && profile.full_name) ||
        "";
      named.set(id, name);
    }
    // Keep any doctor that appears in the appointments but not in the payload,
    // so a filter option never silently disappears.
    for (const row of appointments) {
      if (row.doctor_id && !named.has(row.doctor_id)) named.set(row.doctor_id, "");
    }
    return [...named.entries()].map(([id, name]) => ({ id, name }));
  }, [schedule.data?.doctors, appointments]);

  const doctorName = useCallback(
    (id?: string | null) => {
      if (!id) return "\u2014";
      const match = doctorOptions.find((entry) => entry.id === id);
      return match?.name || `#${id.slice(0, 8)}`;
    },
    [doctorOptions],
  );

  const doctors = useMemo(() => doctorOptions.map((entry) => entry.id), [doctorOptions]);
  const chairs = useMemo(
    () => [...new Set(rooms.map((item) => item.chair_code).filter(Boolean))] as string[],
    [rooms],
  );
  /**
   * Фильтр по статусу из адреса.
   *
   * Показатели на «Главной» ведут сюда именно за срезом: «Завершено» и
   * «Не подтвердили» — это те же записи дня, отобранные по статусу. Без разбора
   * параметра ссылка открывала бы полный список, и число над ссылкой не сошлось
   * бы с тем, что человек увидит после перехода.
   *
   * Статусы в базе встречаются в обоих регистрах, поэтому сравниваем по нижнему.
   */
  const requestedStatus = searchParams.get("status")?.toLowerCase() ?? null;

  const filtered = appointments.filter((row) => {
    const selectedRoom = rooms.find((item) => item.id === row.room_id);
    return (doctor === "all" || row.doctor_id === doctor)
      && (room === "all" || row.room_id === room)
      && (chair === "all" || selectedRoom?.chair_code === chair)
      && (!requestedStatus || (row.status ?? "").toLowerCase() === requestedStatus);
  });

  const bulk = useMutation({
    mutationFn: async () => {
      const rows = appointments.filter((row) => selected.has(row.id));
      if (!rows.length) throw new Error(uz ? "Yozuvlarni tanlang" : "Выберите записи");
      const ids = rows.map((row) => row.id).sort().join(",");
      const actionKey = `appointment-bulk:status:${newStatus}:${ids}`;
      const clientRequestId = getPersistentClientRequestId(user?.id ?? "anonymous", currentClinic!.id, actionKey);
      const result = await bulkAppointments(
        currentClinic!.id,
        clientRequestId,
        rows.map((row) => ({
          appointmentId: row.id,
          action: newStatus === "CANCELLED" ? "cancel" : "status",
          ...(newStatus === "CANCELLED" ? { reason: uz ? "Jadvaldan ommaviy bekor qilindi" : "Массовая отмена из расписания" } : { status: newStatus }),
          expectedVersion: row.version,
        })),
      );
      clearPersistentClientRequestId(user?.id ?? "anonymous", currentClinic!.id, actionKey);
      return result;
    },
    onSuccess: () => {
      setSelected(new Set());
      toast.success(uz ? "Yozuvlar yangilandi" : "Записи обновлены");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof CrmApiError && error.status === 409
          ? uz ? "Jadval o‘zgargan. Ma’lumotlar yangilandi." : "Расписание уже изменилось. Данные обновлены."
          : error.message,
      );
      void schedule.refetch();
    },
  });

  const reschedule = useMutation({
    mutationFn: async () => {
      const row = appointments.find((item) => selected.has(item.id));
      if (!row || selected.size !== 1) throw new Error(uz ? "Bitta yozuvni tanlang" : "Выберите одну запись");
      const actionKey = `appointment-reschedule:${row.id}:${moveDate}:${moveTime}:${moveDoctor}:${moveRoom}`;
      const actor = user?.id ?? "anonymous";
      const clientRequestId = getPersistentClientRequestId(actor, currentClinic!.id, actionKey);
      const result = await bulkAppointments(currentClinic!.id, clientRequestId, [{
        appointmentId: row.id,
        action: "reschedule",
        appointmentDate: moveDate,
        startTime: moveTime,
        doctorId: moveDoctor || row.doctor_id,
        roomId: moveRoom || row.room_id,
        expectedVersion: row.version,
      }]);
      clearPersistentClientRequestId(actor, currentClinic!.id, actionKey);
      return result;
    },
    onSuccess: () => {
      setSelected(new Set());
      toast.success(uz ? "Yozuv ko‘chirildi" : "Запись перенесена");
      void schedule.refetch();
    },
    onError: (error: Error) => {
      // The backend rejects a move onto an occupied slot with an English
      // message; the administrator was shown it raw. Translate the two known
      // outcomes, keep the raw text only for genuinely unknown failures.
      const conflictSlot = /already booked/i.test(error.message);
      toast.error(
        conflictSlot
          ? (uz ? "Bu vaqt allaqachon band. Boshqa vaqtni tanlang." : "Это время уже занято. Выберите другое.")
          : error instanceof CrmApiError && error.status === 409
            ? (uz ? "Jadval o‘zgargan. Yangilandi." : "Расписание изменилось. Данные обновлены.")
            : error.message,
      );
      void schedule.refetch();
    },
  });

  /**
   * Период календаря. Месяц добавлен по макету: запрос уже принимает from/to,
   * поэтому это смена диапазона, а не новый источник данных.
   */
  const RANGE_DAYS: Record<CalendarView, number> = { day: 0, week: 6, month: 29 };

  const setCalendarView = (next: CalendarView) => {
    setView(next);
    const start = new Date(`${from}T12:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + RANGE_DAYS[next]);
    setTo(end.toLocaleDateString("en-CA"));
  };

  /**
   * Показатели расписания из макета.
   *
   * Считаются из уже загруженного периода — новых запросов не нужно. Два
   * показателя эталона («Свободных окон» и «Загрузка кресла») здесь НЕ
   * выводятся: ответ содержит только записи, а не сетку рабочего времени и
   * кабинетов, поэтому свободное время из него не вывести. Показать
   * приблизительное число хуже, чем не показывать: по нему принимают решение,
   * брать ли срочного пациента.
   */
  const todayIso = new Date().toLocaleDateString("en-CA");
  const todayCount = appointments.filter(
    (row) => (row.appointment_date ?? "").slice(0, 10) === todayIso,
  ).length;

  /** Сколько записей ждут подтверждения — число на вкладке, как в макете. */
  const pendingCount = appointments.filter(
    (row) => (row.status ?? "").toLowerCase() === "pending",
  ).length;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <CRMLayout>
      <PermissionGate module="schedule">
        <div className="space-y-5 p-4 pb-24 md:p-6 lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crm.schedule")}</h1><p className="text-sm text-muted-foreground">{uz ? "Shifokor, xona va kreslo bo‘yicha" : "По врачу, кабинету и креслу"}</p></div>
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />{uz ? "Yangi yozuv" : "Новая запись"}</Button>
          </div>
          {/* Показатели периода. Считаются из уже загруженных записей. */}
          <div className="grid grid-cols-2 gap-section sm:max-w-md">
            <Card>
              <CardContent className="px-card-x py-3">
                <p className="text-meta font-medium text-muted-foreground">
                  {uz ? "Bugungi qabullar" : "Приёмов сегодня"}
                </p>
                <p className="text-kpi tabular-nums font-heading">{todayCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-card-x py-3">
                <p className="text-meta font-medium text-muted-foreground">
                  {uz ? "Tasdiqlanmagan" : "Не подтвердили"}
                </p>
                <p className="text-kpi tabular-nums font-heading">{pendingCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Четыре вкладки макета вместо двух кнопок. «Не подтверждены» —
              не период, а срез: он не меняет диапазон дат, а отбирает записи
              по статусу, поэтому ведёт на тот же экран с параметром в адресе,
              который страница уже разбирает выше. */}
          <div className="flex flex-wrap items-center gap-0.5">
            {([
              { key: "day", label: uz ? "Kun" : "День" },
              { key: "week", label: uz ? "Hafta" : "Неделя" },
              { key: "month", label: uz ? "Oy" : "Месяц" },
            ] as Array<{ key: CalendarView; label: string }>).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCalendarView(item.key)}
                aria-pressed={view === item.key}
                className={cn(
                  "cabinet-control inline-flex items-center rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === item.key
                    ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  if (requestedStatus === "pending") next.delete("status");
                  else next.set("status", "pending");
                  return next;
                })
              }
              aria-pressed={requestedStatus === "pending"}
              className={cn(
                "cabinet-control ml-1 inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                requestedStatus === "pending"
                  ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                  : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {uz ? "Tasdiqlanmagan" : "Не подтверждены"}
              {pendingCount > 0 && (
                <span className="rounded-full bg-status-warning-bg px-1.5 text-xs font-bold tabular-nums text-status-warning">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
          <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <Select value={doctor} onValueChange={setDoctor}><SelectTrigger><SelectValue placeholder={uz ? "Shifokor" : "Врач"} /></SelectTrigger><SelectContent><SelectItem value="all">{uz ? "Barcha shifokorlar" : "Все врачи"}</SelectItem>{doctorOptions.map((entry) => <SelectItem key={entry.id} value={entry.id}>{doctorName(entry.id)}</SelectItem>)}</SelectContent></Select>
            <Select value={room} onValueChange={setRoom}><SelectTrigger><SelectValue placeholder={uz ? "Xona" : "Кабинет"} /></SelectTrigger><SelectContent><SelectItem value="all">{uz ? "Barcha xonalar" : "Все кабинеты"}</SelectItem>{rooms.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
            <Select value={chair} onValueChange={setChair}><SelectTrigger><SelectValue placeholder={uz ? "Kreslo" : "Кресло"} /></SelectTrigger><SelectContent><SelectItem value="all">{uz ? "Barcha kreslolar" : "Все кресла"}</SelectItem>{chairs.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select>
          </CardContent></Card>

          {selected.size > 0 && <Card className="sticky top-2 z-20 border-primary/40 bg-background/95 shadow-lg backdrop-blur"><CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"><Badge>{uz ? "Tanlangan" : "Выбрано"}: {selected.size}</Badge><Select value={newStatus} onValueChange={setNewStatus}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONFIRMED">{uz ? "Tasdiqlangan" : "Подтверждена"}</SelectItem><SelectItem value="CANCELLED">{uz ? "Bekor qilingan" : "Отменена"}</SelectItem><SelectItem value="NO_SHOW">{uz ? "Kelmadi" : "Не явился"}</SelectItem></SelectContent></Select><Button disabled={bulk.isPending} onClick={() => bulk.mutate()}><CheckSquare2 className="mr-2 h-4 w-4" />{uz ? "Barchasini yangilash" : "Изменить выбранные"}</Button></CardContent></Card>}

          {selected.size === 1 && (
            <Card className="border-primary/30"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
              <Input type="date" value={moveDate} onChange={(event) => setMoveDate(event.target.value)} aria-label={uz ? "Yangi sana" : "Новая дата"} />
              <Input type="time" value={moveTime} onChange={(event) => setMoveTime(event.target.value)} aria-label={uz ? "Yangi vaqt" : "Новое время"} />
              <Select value={moveDoctor} onValueChange={setMoveDoctor}><SelectTrigger><SelectValue placeholder={uz ? "Shifokorni qoldirish" : "Оставить врача"} /></SelectTrigger><SelectContent>{doctorOptions.map((entry) => <SelectItem key={entry.id} value={entry.id}>{doctorName(entry.id)}</SelectItem>)}</SelectContent></Select>
              <Select value={moveRoom} onValueChange={setMoveRoom}><SelectTrigger><SelectValue placeholder={uz ? "Xonani qoldirish" : "Оставить кабинет"} /></SelectTrigger><SelectContent>{rooms.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
              <Button disabled={reschedule.isPending} onClick={() => reschedule.mutate()}><MoveRight className="mr-2 h-4 w-4" />{uz ? "Ko‘chirish" : "Перенести"}</Button>
            </CardContent></Card>
          )}

          {schedule.isLoading ? <Skeleton className="h-80" /> : schedule.isError ? (
            <Card className="border-destructive/30"><CardContent className="py-14 text-center"><AlertTriangle className="mx-auto mb-3 h-9 w-9 text-destructive" /><p>{uz ? "Jadval yuklanmadi" : "Расписание не загрузилось"}</p><Button className="mt-3" variant="outline" onClick={() => void schedule.refetch()}>{uz ? "Qayta urinish" : "Повторить"}</Button></CardContent></Card>
          ) : filtered.length ? (
            /*
              Was a stack of Cards at roughly 96px per appointment: eight rows
              per screen on a 40-appointment day, with date, time, room and
              chair glued into one grey sentence separated by middots — nothing
              for the eye to scan down. A 40px table row shows 20+ and lets the
              administrator compare two times by looking down a column.
            */
            <DataTable
              rows={filtered}
              getRowId={(row) => row.id}
              dense
              maxHeightClassName="max-h-cabinet"
              caption={uz ? "Klinika jadvali" : "Расписание клиники"}
              className="[&_section]:space-y-0"
              columns={[
                {
                  id: "select",
                  header: <span className="sr-only">{uz ? "Tanlash" : "Выбор"}</span>,
                  className: "w-10",
                  cell: (row) => (
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggle(row.id)}
                      aria-label={`${uz ? "Yozuvni tanlash" : "Выбрать запись"}: ${row.patient_name || ""}`}
                    />
                  ),
                },
                {
                  id: "time",
                  header: uz ? "Vaqt" : "Время",
                  className: "w-32 tabular-nums",
                  cell: (row) => (
                    <span className="tabular-nums">
                      <span className="font-medium">{row.start_time?.slice(0, 5) || "\u2014"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{row.appointment_date}</span>
                    </span>
                  ),
                },
                {
                  id: "patient",
                  header: uz ? "Bemor" : "Пациент",
                  cell: (row) => <span className="font-medium">{row.patient_name || "\u2014"}</span>,
                },
                {
                  id: "doctor",
                  header: uz ? "Shifokor" : "Врач",
                  cell: (row) => <span className="truncate">{doctorName(row.doctor_id)}</span>,
                },
                {
                  id: "room",
                  header: uz ? "Xona / Kreslo" : "Кабинет / Кресло",
                  cell: (row) => {
                    const rowRoom = rooms.find((item) => item.id === row.room_id);
                    if (!rowRoom) {
                      return (
                        <span className="text-muted-foreground">
                          {uz ? "Belgilanmagan" : "Не назначен"}
                        </span>
                      );
                    }
                    return (
                      <span>
                        {rowRoom.name}
                        {rowRoom.chair_code ? (
                          <span className="ml-1 text-muted-foreground">/ {rowRoom.chair_code}</span>
                        ) : null}
                      </span>
                    );
                  },
                },
                {
                  id: "status",
                  header: uz ? "Holat" : "Статус",
                  className: "w-44",
                  cell: (row) => {
                    // Was the raw database enum ("CONFIRMED", "NO_SHOW") shown
                    // to the user. Now the translated label plus an icon, so
                    // the status does not rely on colour alone.
                    const style = getStatusStyle(row.status);
                    const StatusIcon = style.icon;
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                          style.bgColor,
                          style.color,
                        )}
                      >
                        <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                        {style.label}
                      </span>
                    );
                  },
                },
              ]}
              renderMobileRow={(row) => {
                const rowRoom = rooms.find((item) => item.id === row.room_id);
                const style = getStatusStyle(row.status);
                const StatusIcon = style.icon;
                return (
                  <Card>
                    <CardContent className="flex items-start gap-3 p-3">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggle(row.id)}
                        aria-label={`${uz ? "Yozuvni tanlash" : "Выбрать запись"}: ${row.patient_name || ""}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{row.patient_name || "\u2014"}</p>
                        <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                          {row.start_time?.slice(0, 5) || "\u2014"} · {doctorName(row.doctor_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rowRoom?.name || (uz ? "Xona belgilanmagan" : "Кабинет не назначен")}
                          {rowRoom?.chair_code ? ` / ${rowRoom.chair_code}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                          style.bgColor,
                          style.color,
                        )}
                      >
                        <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                        {style.label}
                      </span>
                    </CardContent>
                  </Card>
                );
              }}
            />
          ) : <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-3 h-10 w-10" />{uz ? "Bu davrda yozuvlar yo‘q" : "В этом периоде записей нет"}</CardContent></Card>}

          {createOpen && <Suspense fallback={null}><GuestAppointmentModal open={createOpen} onOpenChange={setCreateOpen} selectedDate={new Date(`${from}T12:00:00`)} /></Suspense>}
        </div>
      </PermissionGate>
    </CRMLayout>
  );
}
