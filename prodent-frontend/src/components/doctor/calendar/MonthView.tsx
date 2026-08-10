import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface Appt {
  id: string;
  appointment_date: string;
  service: string | null;
  status: string;
  patient_id: string;
  patient_name?: string;
}

interface Cell {
  date: Date;
  isOther: boolean;
  isToday: boolean;
  isWeekend: boolean;
  iso: string; // yyyy-MM-dd
}


const buildMonthGrid = (anchor: Date): Cell[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  // Monday-first: leading days from prev month
  const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = new Date(first);
    d.setDate(first.getDate() - i - 1);
    cells.push({
      date: d,
      isOther: true,
      isToday: d.getTime() === today.getTime(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      iso: format(d, "yyyy-MM-dd"),
    });
  }
  // Current month
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), d);
    cells.push({
      date,
      isOther: false,
      isToday: date.getTime() === today.getTime(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      iso: format(date, "yyyy-MM-dd"),
    });
  }
  // Trailing — fill to 42
  while (cells.length < 42) {
    const lastDate = cells[cells.length - 1].date;
    const d = new Date(lastDate);
    d.setDate(lastDate.getDate() + 1);
    cells.push({
      date: d,
      isOther: true,
      isToday: d.getTime() === today.getTime(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      iso: format(d, "yyyy-MM-dd"),
    });
  }
  return cells;
};

interface MonthViewProps {
  doctorId: string;
}

export const MonthView = ({ doctorId }: MonthViewProps) => {
  const { t } = useLanguage();
  const DAYS_HEAD = useMemo(() => [
    t('doctorCalendarWeekView.monday'),
    t('doctorCalendarWeekView.tuesday'),
    t('doctorCalendarWeekView.wednesday'),
    t('doctorCalendarWeekView.thursday'),
    t('doctorCalendarWeekView.friday'),
    t('doctorCalendarWeekView.saturday'),
    t('doctorCalendarWeekView.sunday'),
  ], [t]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const anchor = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    d.setDate(1);
    return d;
  }, [monthOffset]);

  const cells = useMemo(() => buildMonthGrid(anchor), [anchor]);

  const monthStart = useMemo(() => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return d;
  }, [anchor]);

  const monthEnd = useMemo(() => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return d;
  }, [anchor]);

  const { data: appointments } = useQuery({
    queryKey: ["doctor-month-appts", doctorId, monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, service, status, patient_id")
        .eq("doctor_id", doctorId)
        .gte("appointment_date", monthStart.toISOString())
        .lt("appointment_date", monthEnd.toISOString())
        .order("appointment_date", { ascending: true });

      const list = (data || []) as Appt[];
      if (list.length === 0) return list;
      const ids = [...new Set(list.map((a) => a.patient_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const names: Record<string, string> = {};
      profiles?.forEach((p) => {
        names[p.id] = p.full_name || t('crmDashboardWidgets.patientName');
      });
      return list.map((a) => ({
        ...a,
        patient_name: names[a.patient_id] || t('crmDashboardWidgets.patientName'),
      }));
    },
    enabled: !!doctorId,
  });

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appt[]> = {};
    (appointments || []).forEach((a) => {
      const key = format(new Date(a.appointment_date), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  const monthLabel = format(anchor, "LLLL yyyy", { locale: ru });
  const totalAppts = appointments?.length || 0;
  const totalHours = (totalAppts * 30) / 60;
  const days = appointments
    ? new Set(
        appointments.map((a) =>
          format(new Date(a.appointment_date), "yyyy-MM-dd")
        )
      ).size
    : 0;
  const avgPerDay = days > 0 ? (totalAppts / days).toFixed(1) : "0";

  const selectedAppts = selected ? apptsByDay[selected] || [] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('doctorCalendarWeekView.monthBtn')}
          </div>
          <h2 className="font-heading text-xl font-bold tracking-tight capitalize text-foreground">
            {monthLabel}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {totalAppts}
            </span>{" "}
            · <span className="font-semibold text-foreground tabular-nums">{totalHours.toFixed(1)}</span>{" "}
            · <span className="font-semibold text-foreground tabular-nums">{avgPerDay}</span>{" "}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-prodent-input border border-border bg-card">
            <button
              onClick={() => setMonthOffset((o) => o - 1)}
              className="grid h-9 w-9 place-items-center rounded-l-[10px] text-muted-foreground hover:bg-muted/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMonthOffset(0)}
              className="h-9 border-x border-border px-3 text-sm font-medium hover:bg-muted/50"
            >
              {t('doctorCalendarWeekView.todayBtn')}
            </button>
            <button
              onClick={() => setMonthOffset((o) => o + 1)}
              className="grid h-9 w-9 place-items-center rounded-r-[10px] text-muted-foreground hover:bg-muted/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          {/* Week-day header */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS_HEAD.map((dh, i) => (
              <div
                key={dh}
                className={cn(
                  "py-2.5 text-center text-xs font-semibold uppercase tracking-wider",
                  i >= 5 ? "text-muted-foreground" : "text-muted-foreground"
                )}
              >
                {dh}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const items = !cell.isOther ? apptsByDay[cell.iso] || [] : [];
              const dayLoad = items.length * 0.5; // 30 min each
              const loadPct = Math.min(100, Math.round((dayLoad / 9) * 100));
              const doneCount = items.filter(
                (a) =>
                  a.status === "completed" || a.status === "cancelled"
              ).length;
              const isActive = selected === cell.iso;

              return (
                <button
                  key={cell.iso}
                  onClick={() =>
                    !cell.isOther &&
                    items.length > 0 &&
                    setSelected(isActive ? null : cell.iso)
                  }
                  className={cn(
                    "relative flex min-h-[110px] flex-col gap-1 border-b border-r border-border p-2 text-left transition",
                    cell.isOther && "bg-muted/40 text-muted-foreground",
                    !cell.isOther && "hover:bg-muted/50 cursor-pointer",
                    cell.isToday && "bg-primary/10",
                    isActive && "bg-primary/10 ring-1 ring-primary ring-inset z-10",
                    items.length === 0 && !cell.isOther && "cursor-default"
                  )}
                >
                  <div className="flex items-baseline gap-1">
                    <span
                      className={cn(
                        "font-heading text-base font-bold tabular-nums",
                        cell.isOther
                          ? "text-muted-foreground/50"
                          : cell.isToday
                          ? "text-primary"
                          : "text-foreground"
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    {cell.isToday && (
                      <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wider text-primary-foreground">
                        {t('doctorCalendarWeekView.todayBtn')}
                      </span>
                    )}
                  </div>

                  {!cell.isOther && items.length > 0 && (
                    <>
                      <div className="space-y-0.5">
                        {items.slice(0, 3).map((a) => (
                          <div
                            key={a.id}
                            className={cn(
                              "truncate text-xs",
                              a.status === "completed" ||
                                a.status === "cancelled"
                                ? "text-muted-foreground"
                                : "text-foreground"
                            )}
                          >
                            <span className="font-semibold tabular-nums">
                              {format(new Date(a.appointment_date), "HH:mm")}
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {a.patient_name}
                            </span>
                          </div>
                        ))}
                        {items.length > 3 && (
                          <div className="text-xs font-medium text-muted-foreground">
                            + {items.length - 3}
                          </div>
                        )}
                      </div>

                      {/* Load bar */}
                      <div className="mt-auto flex items-center gap-1.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              loadPct > 70
                                ? "bg-primary"
                                : loadPct > 0
                                ? "bg-primary/40"
                                : "bg-muted"
                            )}
                            style={{
                              width: `${loadPct}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {items.length}
                          {doneCount > 0 && (
                            <span className="text-muted-foreground">
                              /{doneCount}
                            </span>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        {selected && selectedAppts.length > 0 && (
          <div className="w-[340px] shrink-0">
            <div className="sticky top-4 overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-3">
                <div>
                  <div className="font-heading text-base font-semibold text-foreground">
                    {format(new Date(selected), "EEEE, d MMMM", { locale: ru })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedAppts.length}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto">
                {selectedAppts.map((a) => {
                  const d = new Date(a.appointment_date);
                  const isDone =
                    a.status === "completed" || a.status === "cancelled";
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-muted/50"
                    >
                      <div
                        className={cn(
                          "w-12 shrink-0 text-right font-heading text-base font-semibold tabular-nums",
                          isDone
                            ? "text-muted-foreground"
                            : "text-foreground"
                        )}
                      >
                        {format(d, "HH:mm")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "truncate text-sm font-semibold",
                            isDone ? "text-muted-foreground" : "text-foreground"
                          )}
                        >
                          {a.patient_name}
                        </div>
                        {a.service && (
                          <div className="truncate text-xs text-muted-foreground">
                            {a.service}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
