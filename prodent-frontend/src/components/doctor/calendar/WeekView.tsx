import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Phone,
  Play,
  Stethoscope,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { a11yLabel } from "@/lib/a11y-labels";
import { formatPatientCardId } from "@/lib/accountId";

interface Appt {
  id: string;
  appointment_date: string;
  service: string | null;
  status: string;
  patient_id: string;
  patient_name?: string;
  patient_card?: string | null;
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const HOUR_PX = 76;
const DAY_START = 8 * 60;

const fmtTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

type ApptStatus = "done" | "now" | "next" | "upcoming";

const BLOCK_TONES: Record<ApptStatus, { bg: string; border: string; dot: string; text: string }> = {
  done: { bg: "#f8fafc", border: "#e2e8f0", dot: "#94a3b8", text: "#64748b" },
  now: { bg: "#f0fdfa", border: "#5eead4", dot: "#0d9488", text: "#115e59" },
  next: { bg: "#ffffff", border: "#cbd5e1", dot: "#0d9488", text: "#0f172a" },
  upcoming: { bg: "#ffffff", border: "#e2e8f0", dot: "#cbd5e1", text: "#0f172a" },
};

const startOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  // Monday-first: Sunday(0) -> -6, Mon(1) -> 0
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

interface WeekViewProps {
  doctorId: string;
}

export const WeekView = ({ doctorId }: WeekViewProps) => {
  const { t } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<Appt | null>(null);

  const monday = useMemo(
    () => addDays(startOfWeek(new Date()), weekOffset * 7),
    [weekOffset]
  );

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(monday, i);
        const isToday = d.toDateString() === new Date().toDateString();
        const isOff = d.getDay() === 0; // Sunday off
        return { date: d, isToday, isOff, idx: i };
      }),
    [monday]
  );

  const weekStart = monday;
  const weekEnd = addDays(monday, 7);

  const { data: appointments } = useQuery({
    queryKey: ["doctor-week-appts", doctorId, weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, service, status, patient_id")
        .eq("doctor_id", doctorId)
        .gte("appointment_date", weekStart.toISOString())
        .lt("appointment_date", weekEnd.toISOString())
        .order("appointment_date", { ascending: true });

      const list = (data || []) as Appt[];
      if (list.length === 0) return list;
      const patientIds = [...new Set(list.map((a) => a.patient_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, account_number")
        .in("id", patientIds);
      const names: Record<string, string> = {};
      const cards: Record<string, string | null> = {};
      profiles?.forEach((p) => {
        names[p.id] = p.full_name || t('doctorWeekView.defaultPatient');
        cards[p.id] = p.account_number ?? null;
      });
      return list.map((a) => ({
        ...a,
        patient_name: names[a.patient_id] || t('doctorWeekView.defaultPatient'),
        patient_card: cards[a.patient_id] ?? null,
      }));
    },
    enabled: !!doctorId,
  });

  const apptsByDay = useMemo(() => {
    const map: Record<number, Appt[]> = {};
    (appointments || []).forEach((a) => {
      const d = new Date(a.appointment_date);
      const dayIdx =
        Math.floor((d.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000));
      if (!map[dayIdx]) map[dayIdx] = [];
      map[dayIdx].push(a);
    });
    return map;
  }, [appointments, monday]);

  const total = appointments?.length ?? 0;
  const totalMinutes = (appointments || []).length * 30;
  const hoursBooked = (totalMinutes / 60).toFixed(1);
  const totalSlot = days.filter((d) => !d.isOff).length * HOURS.length;
  const util = totalSlot > 0 ? Math.round(Number(hoursBooked) / totalSlot * 100) : 0;

  const weekRangeLabel = `${format(monday, "d", { locale: ru })} — ${format(addDays(monday, 6), "d MMMM", { locale: ru })}`;

  const deriveStatus = (a: Appt): ApptStatus => {
    const now = Date.now();
    const start = new Date(a.appointment_date).getTime();
    const end = start + 30 * 60 * 1000;
    if (a.status === "completed" || a.status === "cancelled") return "done";
    if (now >= start && now <= end) return "now";
    if (start > now) return "upcoming";
    return "done";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('doctorWeekView.weekLabel')} · {weekOffset === 0 ? t('doctorWeekView.currentWeek') : weekOffset > 0 ? `+${weekOffset}` : weekOffset}
          </div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
            {weekRangeLabel}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{total}</span>{" "}
            {t('doctorWeekView.appointmentsCount')} · <span className="font-semibold text-foreground tabular-nums">{hoursBooked} {t('doctorWeekView.hoursWork')}</span>{" "}
            · {t('doctorWeekView.utilization')}{" "}
            <span className="font-semibold text-foreground tabular-nums">{util}%</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-prodent-input border border-border bg-card">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="grid h-9 w-9 place-items-center rounded-l-[10px] text-muted-foreground hover:bg-muted/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="h-9 border-x border-border px-3 text-sm font-medium hover:bg-muted/50"
            >
              {t('doctorWeekView.todayBtn')}
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="grid h-9 w-9 place-items-center rounded-r-[10px] text-muted-foreground hover:bg-muted/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid + side panel */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="overflow-x-auto">
            <div className="min-w-[1040px]">
              {/* Header row */}
              <div
                className="grid border-b border-border"
                style={{
                  gridTemplateColumns: `60px repeat(${days.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="bg-muted/50" />
                {days.map((d) => {
                  const dayCount = apptsByDay[d.idx]?.length || 0;
                  return (
                    <div
                      key={d.idx}
                      className={cn(
                        "flex flex-col gap-1.5 border-l border-border px-3 py-3",
                        d.isToday && "bg-primary/10",
                        d.isOff && "bg-muted/50"
                      )}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            d.isToday
                              ? "text-primary"
                              : d.isOff
                              ? "text-muted-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {format(d.date, "EEE", { locale: ru })}
                        </span>
                        <span
                          className={cn(
                            "font-heading text-lg font-bold leading-none tabular-nums",
                            d.isToday
                              ? "text-primary"
                              : d.isOff
                              ? "text-muted-foreground"
                              : "text-foreground"
                          )}
                        >
                          {format(d.date, "d", { locale: ru })}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            d.isToday
                              ? "text-primary/80"
                              : "text-muted-foreground"
                          )}
                        >
                          {format(d.date, "MMM", { locale: ru })}
                        </span>
                        {d.isToday && (
                          <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wider text-white">
                            {t('doctorWeekView.todayBadge')}
                          </span>
                        )}
                        {d.isOff && (
                          <span className="ml-auto text-xs italic text-muted-foreground">
                            {t('doctorWeekView.offDay')}
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "text-right text-xs tabular-nums",
                          d.isToday
                            ? "font-semibold text-primary"
                            : d.isOff
                            ? "text-muted-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {d.isOff ? "—" : `${dayCount} ${t('doctorWeekView.appointmentsCountShort')}`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Body */}
              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `60px repeat(${days.length}, minmax(0, 1fr))`,
                }}
              >
                {/* Hours gutter */}
                <div className="relative bg-muted/50/40">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="border-b border-border pr-2 pt-1 text-right"
                      style={{ height: `${HOUR_PX}px` }}
                    >
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {days.map((d) => (
                  <div
                    key={d.idx}
                    className={cn(
                      "relative border-l border-border",
                      d.isToday && "bg-primary/10/25",
                      d.isOff && "bg-[repeating-linear-gradient(135deg,#f8fafc,#f8fafc_6px,#f1f5f9_6px,#f1f5f9_12px)]"
                    )}
                  >
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="border-b border-border"
                        style={{ height: `${HOUR_PX}px` }}
                      />
                    ))}

                    {!d.isOff &&
                      (apptsByDay[d.idx] || []).map((a) => {
                        const startTime = new Date(a.appointment_date);
                        const m = startTime.getHours() * 60 + startTime.getMinutes();
                        const top = ((m - DAY_START) / 60) * HOUR_PX;
                        const dur = 30;
                        const height = (dur / 60) * HOUR_PX - 2;
                        const status = deriveStatus(a);
                        const tone = BLOCK_TONES[status];
                        const isNow = status === "now";
                        const isDone = status === "done";

                        return (
                          <button
                            key={a.id}
                            onClick={() => setSelected(a)}
                            className={cn(
                              "group absolute left-1 right-1 overflow-hidden rounded-[8px] text-left transition-all hover:-translate-y-px hover:shadow-sm",
                              isDone && "opacity-70",
                              selected?.id === a.id && "z-20"
                            )}
                            style={{
                              top: `${top}px`,
                              height: `${Math.max(height, 22)}px`,
                              background: tone.bg,
                              border: `1px solid ${tone.border}`,
                              borderLeft: `3px solid ${tone.dot}`,
                              boxShadow:
                                selected?.id === a.id
                                  ? `0 0 0 2px hsl(var(--brand)), 0 6px 18px -6px rgba(13,148,136,0.35)`
                                  : isNow
                                  ? `0 0 0 2px ${tone.dot}, 0 4px 14px -4px ${tone.dot}40`
                                  : undefined,
                            }}
                          >
                            <div
                              className="flex h-full flex-col gap-0.5 px-2 py-1"
                              style={{ color: tone.text }}
                            >
                              <div className="flex items-center gap-1 text-xs font-semibold leading-none tabular-nums text-muted-foreground">
                                <span>{fmtTime(m)}</span>
                                <span className="font-medium opacity-70">
                                  · {dur}{t('doctorWeekView.durationMin')}
                                </span>
                                {isNow && (
                                  <span
                                    className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full"
                                    style={{ background: tone.dot }}
                                  />
                                )}
                              </div>
                              <div
                                className="truncate font-heading text-xs font-semibold leading-tight text-foreground"
                              >
                                {a.patient_name}
                              </div>
                              {a.service && (
                                <div className="truncate text-xs leading-tight text-muted-foreground">
                                  {a.service}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <DetailPanel
            a={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
};

const DetailPanel = ({
  a,
  onClose,
}: {
  a: Appt;
  onClose: () => void;
}) => {
  const { t } = useLanguage();
  const start = new Date(a.appointment_date);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const dayLabel = format(start, "EEE, d MMMM", { locale: ru });

  return (
    <div className="w-[340px] shrink-0">
      <div className="sticky top-4 overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('doctorWeekView.scheduled')}
          </span>
          <button
            onClick={onClose}
            className="ml-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
           aria-label={a11yLabel("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-card-x">
          <div className="flex items-center gap-3">
            <Avatar name={a.patient_name || t('doctorWeekView.defaultPatient')} size={44} />
            <div className="min-w-0">
              <div className="truncate font-heading text-base font-semibold text-foreground">
                {a.patient_name || t('doctorWeekView.defaultPatient')}
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                #P-{formatPatientCardId(a.patient_card, a.patient_id)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="mb-0.5 text-muted-foreground">{t('doctorWeekView.whenLabel')}</div>
              <div className="font-semibold tabular-nums text-foreground">
                {fmtTime(start.getHours() * 60 + start.getMinutes())}–
                {fmtTime(end.getHours() * 60 + end.getMinutes())}
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                {dayLabel} · {t('doctorWeekView.durationFull')}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-muted-foreground">{t('doctorWeekView.roomLabel')}</div>
              <div className="font-semibold text-foreground">{t('doctorWeekView.roomDefault')}</div>
            </div>
          </div>

          <dl className="mt-4 divide-y divide-border border-y border-border text-xs">
            <div className="flex py-2">
              <dt className="w-[100px] shrink-0 text-muted-foreground">{t('doctorWeekView.procedureLabel')}</dt>
              <dd className="flex-1 font-medium text-foreground">
                {a.service || "—"}
              </dd>
            </div>
            <div className="flex py-2">
              <dt className="w-[100px] shrink-0 text-muted-foreground">{t('doctorWeekView.allergiesLabel')}</dt>
              <dd className="flex-1 inline-flex items-center gap-1.5 font-medium text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                {t('doctorWeekView.noAllergies')}
              </dd>
            </div>
            <div className="flex py-2">
              <dt className="w-[100px] shrink-0 text-muted-foreground">{t('doctorWeekView.statusLabel')}</dt>
              <dd className="flex-1 font-medium text-foreground">{a.status}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-2 border-t border-border bg-muted/50 px-5 py-3">
          <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-prodent-input bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(var(--brand-700))]">
            <Stethoscope className="h-4 w-4" />
            {t('doctorWeekView.openMedRecord')}
          </button>
          <div className="flex items-center gap-1.5">
            <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50">
              <Play className="h-3.5 w-3.5" />
              {t('doctorWeekView.startBtn')}
            </button>
            <button
              type="button"
              title={t('doctorWeekView.callTitle')}
              aria-label={t('doctorWeekView.callTitle')}
              className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1 after:content-['']"
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t('doctorWeekView.rescheduleTitle')}
              aria-label={t('doctorWeekView.rescheduleTitle')}
              className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1 after:content-['']"
            >
              <Calendar aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
