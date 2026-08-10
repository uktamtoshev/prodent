import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import { DoctorTopbar } from "@/components/doctor/DoctorTopbar";
import { WeekView } from "@/components/doctor/calendar/WeekView";
import { MonthView } from "@/components/doctor/calendar/MonthView";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  ChevronRight,
  Filter,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Stethoscope,
  X,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { a11yLabel } from "@/lib/a11y-labels";
import { formatPatientCardId } from "@/lib/accountId";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string | null;
  end_time: string | null;
  service: string | null;
  status: string;
  notes: string | null;
  patient_id: string;
  patient_name?: string;
  patient_card?: string | null;
  patient_age?: number | null;
  isNew?: boolean;
}

type ViewMode = "day" | "week" | "month";

const DEFAULT_APPOINTMENT_DURATION_MS = 30 * 60 * 1000;

const localDateTime = (
  dateValue: string,
  timeValue: string | null | undefined,
): Date | null => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateValue);
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(timeValue || "");
  if (!dateMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const second = timeMatch?.[3] ? Number(timeMatch[3]) : 0;
  if (
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const result = new Date(year, month, day, hour, minute, second);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) {
    return null;
  }
  return result;
};

const appointmentStart = (appointment: Appointment) =>
  localDateTime(appointment.appointment_date, appointment.start_time);

const appointmentEndMs = (appointment: Appointment) => {
  const start = appointmentStart(appointment);
  if (!start) return 0;
  const end = localDateTime(appointment.appointment_date, appointment.end_time);
  return end && end.getTime() > start.getTime()
    ? end.getTime()
    : start.getTime() + DEFAULT_APPOINTMENT_DURATION_MS;
};

const appointmentDurationMinutes = (appointment: Appointment) => {
  const start = appointmentStart(appointment);
  if (!start) return 30;
  return Math.max(
    1,
    Math.round((appointmentEndMs(appointment) - start.getTime()) / 60_000),
  );
};

const appointmentTimeLabel = (appointment: Appointment) => {
  const start = appointmentStart(appointment);
  return start ? format(start, "HH:mm") : appointment.start_time?.slice(0, 5) || "—";
};

const deriveStatus = (apt: Appointment, arr: Appointment[]) => {
  const now = Date.now();
  const start = appointmentStart(apt)?.getTime() ?? 0;
  const end = appointmentEndMs(apt);
  // Status is stored uppercase (CHECK constraint) but legacy code compared
  // lowercase — lowercase the raw value before comparing.
  const st = (apt.status || "").toLowerCase();
  if (st === "completed") return "done" as const;
  if (st === "cancelled") return "done" as const;
  if (now >= start && now <= end) return "now" as const;
  if (start > now) {
    const firstFuture = arr.find(
      (appointment) => (appointmentStart(appointment)?.getTime() ?? 0) > now,
    );
    if (firstFuture?.id === apt.id) return "next" as const;
    return "upcoming" as const;
  }
  return "done" as const;
};

export default function DoctorCalendar() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("day");
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const loadSequence = useRef(0);

  const loadDoctorAndAppointments = useCallback(async () => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    setLoadError(false);
    try {
      const { data: doc, error: doctorError } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (doctorError) throw doctorError;
      if (requestId !== loadSequence.current) return;

      if (!doc) {
        setDoctorId(null);
        setAppointments([]);
        return;
      }
      setDoctorId(doc.id);

      const today = new Date();

      const { data: apts, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, end_time, service, status, notes, patient_id")
        .eq("doctor_id", doc.id)
        // appointment_date is a DATE column — match it against a yyyy-MM-dd
        // string (like "Мой день" does). The old .toISOString() range compared
        // a date column to a UTC timestamp, which the PostgREST shim returned
        // empty for, so the schedule showed no visits even when they existed.
        .eq("appointment_date", format(today, "yyyy-MM-dd"))
        .order("start_time", { ascending: true });
      if (appointmentsError) throw appointmentsError;
      if (requestId !== loadSequence.current) return;

      const list = (apts || []) as Appointment[];

      if (list.length > 0) {
        const patientIds = [...new Set(list.map((a) => a.patient_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, account_number")
          .in("id", patientIds);
        if (profilesError) throw profilesError;
        if (requestId !== loadSequence.current) return;

        const names: Record<string, string> = {};
        const cards: Record<string, string | null> = {};
        profiles?.forEach((p) => {
          names[p.id] = p.full_name || t("doctorCalendar.defaultPatient");
          cards[p.id] = p.account_number ?? null;
        });

        setAppointments(
          list.map((a) => ({
            ...a,
            patient_name: names[a.patient_id] || t("doctorCalendar.defaultPatient"),
            patient_card: cards[a.patient_id] ?? null,
          }))
        );
      } else {
        setAppointments([]);
      }
    } catch (e) {
      console.error("Calendar load error", e);
      if (requestId === loadSequence.current) {
        setAppointments([]);
        setLoadError(true);
      }
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  }, [t, user?.id]);

  useEffect(() => {
    if (user?.id) {
      void loadDoctorAndAppointments();
      return;
    }
    loadSequence.current += 1;
    setDoctorId(null);
    setAppointments([]);
    setLoadError(false);
    setLoading(false);
  }, [loadDoctorAndAppointments, user?.id]);

  const { doneCount, upcomingCount, nowApt, nextApt } = useMemo(() => {
    const now = Date.now();
    const done = appointments.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s === "completed" || s === "cancelled";
    });
    const upcoming = appointments.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s !== "completed" && s !== "cancelled";
    });
    const current = appointments.find((a) => {
      const start = appointmentStart(a)?.getTime() ?? 0;
      return now >= start && now <= appointmentEndMs(a);
    });
    const next = appointments.find(
      (a) => (appointmentStart(a)?.getTime() ?? 0) > now
    );
    return {
      doneCount: done.length,
      upcomingCount: upcoming.length,
      nowApt: current,
      nextApt: next && next.id !== current?.id ? next : undefined,
    };
  }, [appointments]);

  const today = new Date();

  return (
    <DoctorLayout>
      <DoctorTopbar
        title={t("doctorCalendar.title")}
        subtitle={t("doctorCalendar.subtitle")}
      />
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {format(today, "EEEE · d MMMM", { locale: ru })}
            </div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
              {t("doctorCalendar.myDay")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("doctorMyDay.appointmentsAccepted")} <span className="font-semibold tabular-nums text-foreground">{doneCount}</span>{" "}
              {t("doctorMyDay.appointmentsOf")} <span className="tabular-nums">{appointments.length}</span> · {t("doctorMyDay.appointmentsLeft")}{" "}
              <span className="font-semibold tabular-nums text-foreground">{upcomingCount}</span>
            </p>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <ViewTabs view={view} onChange={setView} labels={{ day: t("doctorCalendar.tabDay"), week: t("doctorCalendar.tabWeek"), month: t("doctorCalendar.tabMonth") }} />
            <button
              onClick={() => toast.info(t("doctorCalendar.windowComingSoon"))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              <Plus className="h-4 w-4" />
              {t("doctorCalendar.window")}
            </button>
            <button
              onClick={() => toast.info(t("doctorCalendar.quickComingSoon"))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Zap className="h-4 w-4" />
              {t("doctorCalendar.quickAppointment")}
            </button>
          </div>
        </div>

        {view === "week" && doctorId && <WeekView doctorId={doctorId} />}
        {view === "month" && doctorId && <MonthView doctorId={doctorId} />}
        {view !== "day" && !doctorId && (
          <div className="rounded-prodent border border-dashed border-border bg-card px-6 py-12 text-center">
            <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <div className="font-heading text-base font-bold text-foreground">
              {t("doctorCalendar.profileNotFound")}
            </div>
          </div>
        )}

        {view === "day" && (
          <div className="grid grid-cols-12 gap-6">
            {/* Left: schedule */}
            <div className="col-span-12 xl:col-span-8">
              <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex items-center border-b border-border px-4 py-3">
                  <div className="font-heading text-base font-bold text-foreground">
                    {t("doctorCalendar.schedule")}
                  </div>
                  <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                    <button className="inline-flex items-center gap-1 hover:text-foreground">
                      <Filter className="h-3.5 w-3.5" />
                      {t("doctorCalendar.filter")}
                    </button>
                    <span className="h-3 w-px bg-muted" />
                    <span className="tabular-nums">
                      {doneCount} / {appointments.length} {t("doctorCalendar.appointmentsCounter")}
                    </span>
                  </div>
                </div>

                {loading ? (
                  <div className="flex h-[240px] items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : loadError ? (
                  <div className="px-6 py-12 text-center" role="alert">
                    <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" aria-hidden="true" />
                    <div className="font-heading text-base font-bold text-foreground">
                      {t("common.error")}
                    </div>
                    <button
                      type="button"
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-prodent-input border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
                      onClick={() => void loadDoctorAndAppointments()}
                    >
                      {t("common.retry")}
                    </button>
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <div className="font-heading text-base font-bold text-foreground">
                      {t("doctorCalendar.noAppointmentsToday")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {t("doctorCalendar.freeDayDesc")}
                    </div>
                  </div>
                ) : (
                  appointments.map((a) => {
                    const s = deriveStatus(a, appointments);
                    return (
                      <AppointmentRow
                        key={a.id}
                        apt={a}
                        status={s}
                        onOpen={() => navigate(`/doctor/patients/${a.patient_id}`)}
                        labels={{
                          minSuffix: t("doctor.min"),
                          defaultPatient: t("doctorCalendar.defaultPatient"),
                          visit: t("doctorCalendar.visit"),
                          accepted: t("doctorCalendar.accepted"),
                          now: t("doctorCalendar.now"),
                          nextLabel: t("doctorCalendar.nextLabel"),
                          continue: t("doctorCalendar.continue"),
                          start: t("doctorCalendar.start"),
                          open: t("doctorCalendar.open"),
                          card: t("doctorCalendar.card"),
                          more: t("doctorCalendar.moreActions"),
                          openVisit: t("doctorCalendar.openVisit"),
                          reschedule: t("doctorCalendar.reschedule"),
                          rescheduleSoon: t("doctorCalendar.rescheduleComingSoon"),
                          remind: t("doctorCalendar.remind"),
                          reminderComingSoon: t("doctorCalendar.reminderComingSoon"),
                          cancel: t("doctorCalendar.cancel"),
                          cancelSoon: t("doctorCalendar.cancelComingSoon"),
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: focus panel */}
            <div className="col-span-12 space-y-4 xl:col-span-4">
              <NowPanel
                nowApt={nowApt}
                nextApt={nextApt}
                onOpen={() => nowApt && navigate(`/doctor/patients/${nowApt.patient_id}`)}
                labels={{
                  noOneNow: t("doctorCalendar.noOneNow"),
                  nextAt: t("doctorCalendar.nextAt"),
                  nextPatientPrefix: t("doctorCalendar.nextPatientPrefix"),
                  freeTime: t("doctorCalendar.freeTime"),
                  defaultPatient: t("doctorCalendar.defaultPatient"),
                  onAppointment: t("doctorCalendar.onAppointment"),
                  minSuffix: t("doctor.min"),
                  procedure: t("doctorCalendar.procedure"),
                  allergies: t("doctorCalendar.allergies"),
                  noAllergies: t("doctorCalendar.noAllergies"),
                  nextStep: t("doctorCalendar.nextStep"),
                  byPlan: t("doctorCalendar.byPlan"),
                  continueAppointment: t("doctorCalendar.continueAppointment"),
                  next: t("doctorCalendar.next"),
                  details: t("doctorCalendar.details"),
                }}
              />
              <TasksPanel
                labels={{
                  task1: t("doctorCalendar.task1"),
                  task1Due: t("doctorCalendar.task1Due"),
                  task2: t("doctorCalendar.task2"),
                  task2Due: t("doctorCalendar.task2Due"),
                  task3: t("doctorCalendar.task3"),
                  task3Due: t("doctorCalendar.task3Due"),
                  tasksTitle: t("doctorCalendar.tasks"),
                  allTasks: t("doctorCalendar.allTasks"),
                }}
              />
            </div>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}

// ───────────────────────── ViewTabs ─────────────────────────
const ViewTabs = ({
  view,
  onChange,
  labels,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
  labels: { day: string; week: string; month: string };
}) => (
  <div className="flex items-center gap-1 rounded-prodent-input bg-muted p-1">
    {(
      [
        { k: "day" as const, label: labels.day },
        { k: "week" as const, label: labels.week },
        { k: "month" as const, label: labels.month },
      ]
    ).map((t) => (
      <button
        key={t.k}
        onClick={() => onChange(t.k)}
        className={cn(
          "min-h-11 rounded-[7px] px-3.5 text-xs font-medium transition",
          view === t.k
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t.label}
      </button>
    ))}
  </div>
);

// ───────────────────────── AppointmentRow ─────────────────────────
const AppointmentRow = ({
  apt,
  status,
  onOpen,
  labels,
}: {
  apt: Appointment;
  status: "done" | "now" | "next" | "upcoming";
  onOpen: () => void;
  labels: {
    minSuffix: string;
    defaultPatient: string;
    visit: string;
    accepted: string;
    now: string;
    nextLabel: string;
    continue: string;
    start: string;
    open: string;
    card: string;
    more: string;
    openVisit: string;
    reschedule: string;
    rescheduleSoon: string;
    remind: string;
    reminderComingSoon: string;
    cancel: string;
    cancelSoon: string;
  };
}) => {
  const isLive = status === "now";
  const isDone = status === "done";
  const isNext = status === "next";
  const time = appointmentTimeLabel(apt);
  const dur = appointmentDurationMinutes(apt);
  const name = apt.patient_name || labels.defaultPatient;

  return (
    <div
      className={cn(
        "relative flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 transition last:border-b-0 sm:flex-nowrap sm:gap-4",
        isLive ? "bg-primary/10" : "bg-card hover:bg-muted/50",
        isDone && "opacity-60"
      )}
    >
      {isLive && (
        <span
          className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full"
          style={{ background: "hsl(var(--brand))" }}
        />
      )}

      <div className="w-[56px] shrink-0">
        <div
          className={cn(
            "font-heading text-base font-semibold tabular-nums",
            isLive ? "text-primary" : "text-foreground"
          )}
        >
          {time}
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">{dur} {labels.minSuffix}</div>
      </div>

      <Avatar name={name} size={36} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "truncate text-base font-semibold",
              isDone ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {name}
          </div>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {apt.service || apt.notes || labels.visit}
        </div>
      </div>

      <div className="hidden w-[82px] shrink-0 text-right md:block">
        {isDone && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            {labels.accepted}
          </span>
        )}
        {isLive && (
          <span className="text-xs font-semibold text-primary">
            {labels.now}
          </span>
        )}
        {isNext && (
          <span className="text-xs font-medium text-status-info">{labels.nextLabel}</span>
        )}
      </div>

      <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
        {isLive ? (
          <button
            onClick={onOpen}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            {labels.continue}
          </button>
        ) : isNext ? (
          <button
            onClick={onOpen}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <Play className="h-3.5 w-3.5" />
            {labels.start}
          </button>
        ) : !isDone ? (
          <button
            onClick={onOpen}
            className="min-h-11 rounded-prodent-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {labels.open}
          </button>
        ) : (
          <button
            onClick={onOpen}
            className="min-h-11 rounded-prodent-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {labels.card}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
            className="grid min-h-11 min-w-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title={labels.more}
             aria-label={a11yLabel("more")}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>
              <Stethoscope className="mr-2 h-4 w-4" /> {labels.openVisit}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info(labels.rescheduleSoon)}>
              <CalendarDays className="mr-2 h-4 w-4" /> {labels.reschedule}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info(labels.reminderComingSoon)}>
              <MessageCircle className="mr-2 h-4 w-4" /> {labels.remind}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => toast.info(labels.cancelSoon)}
            >
              <X className="mr-2 h-4 w-4" /> {labels.cancel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// ───────────────────────── NowPanel ─────────────────────────
const NowPanel = ({
  nowApt,
  nextApt,
  onOpen,
  labels,
}: {
  nowApt?: Appointment;
  nextApt?: Appointment;
  onOpen: () => void;
  labels: {
    noOneNow: string;
    nextAt: string;
    nextPatientPrefix: string;
    freeTime: string;
    defaultPatient: string;
    onAppointment: string;
    minSuffix: string;
    procedure: string;
    allergies: string;
    noAllergies: string;
    nextStep: string;
    byPlan: string;
    continueAppointment: string;
    next: string;
    details: string;
  };
}) => {
  if (!nowApt) {
    return (
      <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <span className="font-heading text-base font-bold text-foreground">
            {labels.noOneNow}
          </span>
          {nextApt && (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {labels.nextAt} {appointmentTimeLabel(nextApt)}
            </span>
          )}
        </div>
        <div className="p-5 text-center">
          <div className="text-sm text-muted-foreground">
            {nextApt
              ? `${labels.nextPatientPrefix} ${nextApt.patient_name || labels.defaultPatient}`
              : labels.freeTime}
          </div>
        </div>
      </div>
    );
  }

  const start = appointmentStart(nowApt)?.getTime() ?? Date.now();
  const elapsed = Math.max(0, Math.round((Date.now() - start) / 60000));

  return (
    <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div
        className="flex items-center gap-2 border-b border-border px-5 py-3"
        style={{ background: "hsl(var(--brand-50))" }}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          {labels.onAppointment}
        </span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {appointmentTimeLabel(nowApt)} · {elapsed} {labels.minSuffix}
        </span>
      </div>

      <div className="p-card-x">
        <div className="flex items-center gap-3">
          <Avatar name={nowApt.patient_name || labels.defaultPatient} size={48} />
          <div className="min-w-0">
            <div className="truncate font-heading text-base font-bold text-foreground">
              {nowApt.patient_name || labels.defaultPatient}
            </div>
            <div className="text-xs text-muted-foreground">
              #P-{formatPatientCardId(nowApt.patient_card, nowApt.patient_id)}
            </div>
          </div>
        </div>

        <dl className="mt-4 divide-y divide-border border-b border-t border-border text-xs">
          <div className="flex py-2">
            <dt className="w-[110px] text-muted-foreground">{labels.procedure}</dt>
            <dd className="flex-1 font-medium text-foreground">
              {nowApt.service || nowApt.notes || "—"}
            </dd>
          </div>
          <div className="flex py-2">
            <dt className="w-[110px] text-muted-foreground">{labels.allergies}</dt>
            <dd className="inline-flex flex-1 items-center gap-1.5 font-medium text-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              {labels.noAllergies}
            </dd>
          </div>
          <div className="flex py-2">
            <dt className="w-[110px] text-muted-foreground">{labels.nextStep}</dt>
            <dd className="flex-1 font-medium text-foreground">{labels.byPlan}</dd>
          </div>
        </dl>

        <button
          onClick={onOpen}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-prodent-input bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Stethoscope className="h-4 w-4" />
          {labels.continueAppointment}
        </button>
        {nextApt && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {labels.next}{" "}
              <span className="font-medium text-foreground">
                {nextApt.patient_name || labels.defaultPatient}
              </span>{" "}
              · {appointmentTimeLabel(nextApt)}
            </span>
            <button className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
              {labels.details}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ───────────────────────── TasksPanel ─────────────────────────
const TasksPanel = ({
  labels,
}: {
  labels: {
    task1: string;
    task1Due: string;
    task2: string;
    task2Due: string;
    task3: string;
    task3Due: string;
    tasksTitle: string;
    allTasks: string;
  };
}) => {
  const [tasks, setTasks] = useState([
    { t: labels.task1, due: labels.task1Due, urgent: true, done: false },
    { t: labels.task2, due: labels.task2Due, urgent: false, done: false },
    { t: labels.task3, due: labels.task3Due, urgent: false, done: false },
  ]);

  const toggleTask = (i: number) =>
    setTasks((ts) => ts.map((t, j) => (i === j ? { ...t, done: !t.done } : t)));

  const undone = tasks.filter((t) => !t.done).length;

  return (
    <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center border-b border-border px-5 py-3">
        <div className="font-heading text-base font-bold text-foreground">
          {labels.tasksTitle}
        </div>
        <span className="ml-2 rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {undone}
        </span>
        <button className="ml-auto text-xs text-primary hover:underline">
          {labels.allTasks}
        </button>
      </div>
      <ul>
        {tasks.map((x, i) => (
          <li
            key={i}
            className="flex items-start gap-3 border-b border-border px-5 py-2.5 text-sm last:border-b-0 hover:bg-muted/50"
          >
            <input
              type="checkbox"
              checked={x.done}
              onChange={() => toggleTask(i)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate",
                  x.done ? "text-muted-foreground line-through" : "text-foreground"
                )}
              >
                {x.t}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-xs",
                  x.urgent && !x.done
                    ? "font-medium text-status-danger"
                    : "text-muted-foreground"
                )}
              >
                {x.due}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
