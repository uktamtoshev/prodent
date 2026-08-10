import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import { DoctorTopbar } from "@/components/doctor/DoctorTopbar";
import { QuickAppointmentDialog } from "@/components/crm/QuickAppointmentDialog";
import { ScheduleBlockDialog } from "@/components/crm/ScheduleBlockDialog";
import { ConfirmDialog } from "@/components/system/ConfirmDialog";
import {
  Calendar as CalendarIcon,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Play,
  Plus,
  Stethoscope,
  AlertCircle,
  Check,
  Zap,
  UserCircle,
  XCircle,
  FileText as FileTextIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  cancelAppointment,
  getDoctorPendingTimeRequests,
  getDoctorMyDayAppointments,
  updateAppointmentStatus,
} from "@/lib/appointment-api";
import {
  getDoctorMyDayStatus,
  type DoctorMyDayStatus,
} from "@/lib/doctorMyDayStatus";
import { getTashkentCalendarDate } from "@/lib/tashkentTime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─────────────────────────── helpers ───────────────────────────

/**
 * Decorative identity tints, hashed from the patient's name so the same person
 * always gets the same chip — it helps the eye re-find a row in a long day.
 *
 * These are DECORATION, not status, so they deliberately avoid the
 * `status-*` tokens: a green avatar must never read as "everything is fine".
 * Token pairs only, so they survive the dark theme (the previous
 * `bg-teal-100 text-teal-800` set went invisible on a dark card).
 */
const AVATAR_PALETTE = [
  "bg-primary/10 text-primary",
  "bg-secondary text-secondary-foreground",
  "bg-brand-100 text-brand-700",
  "bg-muted text-foreground",
  "bg-primary/15 text-primary",
];

const Avatar = ({ name, size = 36 }: { name: string; size?: number }) => {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const hue =
    [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTE.length;
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold shrink-0",
        AVATAR_PALETTE[hue]
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials}
    </div>
  );
};

const Card = ({
  children,
  className = "",
  pad = "p-card-x",
}: {
  children: React.ReactNode;
  className?: string;
  pad?: string;
}) => (
  // The inline boxShadow that used to live here is the `shadow-design-card`
  // utility in index.css, verbatim — 29 copies of the same rgba pair were
  // scattered across the cabinet. Use the utility.
  <div
    className={cn(
      "rounded-prodent border border-border bg-card shadow-design-card",
      pad,
      className
    )}
  >
    {children}
  </div>
);

// ─────────────────────────── types ───────────────────────────

type ApptStatus = DoctorMyDayStatus;

/** Срезы «Моего дня» из макета. */
type MyDayTab = "all" | "confirmed" | "pending" | "done" | "cancelled" | "upcoming";

interface ApptVm {
  id: string;
  time: string;
  durMin: number;
  patientName: string;
  patientAge?: number;
  type: string;
  status: ApptStatus;
  /** Сырой статус из ответа: вкладки эталона (подтверждены / ждут / отменены)
      различают состояния, которых нет в укрупнённом status. */
  rawStatus?: string;
  isNew: boolean;
  patientId: string;
  rawStart: Date;
}

type AppointmentRow = {
  id: string;
  patient_id?: string | null;
  service_id?: string | null;
  appointment_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  notes?: string | null;
};

type PatientRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  created_at?: string | null;
};

type ServiceRow = {
  id: string;
  name_ru?: string | null;
};

type DoctorProfileRow = {
  first_name?: string | null;
  full_name?: string | null;
};

type DoctorUserWithMetadata = {
  firstName?: string | null;
  first_name?: string | null;
  email?: string | null;
  user_metadata?: {
    first_name?: string | null;
  } | null;
};

// ─────────────────────────── data hook ───────────────────────────

const calcAge = (dob?: string | null): number | undefined => {
  if (!dob) return undefined;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

function useTodayAppointments(doctorId: string | undefined, fallbackNoName: string, fallbackApptType: string) {
  return useQuery({
    queryKey: ["doctor-my-day", doctorId],
    queryFn: async (): Promise<ApptVm[]> => {
      if (!doctorId) return [];
      const protectedRows = await getDoctorMyDayAppointments();
      return protectedRows.map((row) => {
        const start = new Date(`${row.appointmentDate}T${row.startTime}:00+05:00`);
        const end = new Date(`${row.appointmentDate}T${row.endTime}:00+05:00`);
        return {
          id: row.id,
          time: row.startTime.slice(0, 5),
          durMin: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)),
          patientName: row.patientName || fallbackNoName,
          type: row.notes || fallbackApptType,
          status: getDoctorMyDayStatus(row.status, start),
          rawStatus: String(row.status ?? ""),
          isNew: false,
          patientId: row.patientId || row.guestPatientId || "",
          rawStart: start,
        };
      });
      /*
       * Legacy direct-table mapping is kept temporarily below as a rollback
       * reference. It is unreachable; the protected endpoint above is the
       * only runtime source for My Day.
       */
      const today = new Date();
      const yyyyMmDd = format(today, "yyyy-MM-dd");

      const { data: rows, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, patient_id, service_id, appointment_date, start_time, end_time, status, notes")
        .eq("doctor_id", doctorId)
        .eq("appointment_date", yyyyMmDd)
        .order("start_time", { ascending: true });
      if (appointmentsError) throw appointmentsError;
      if (!rows || rows.length === 0) return [];

      const patientIds = [
        ...new Set<string>(
          (rows as AppointmentRow[])
            .map((row) => row.patient_id)
            .filter((id: unknown): id is string => typeof id === "string"),
        ),
      ];
      const serviceIds = [
        ...new Set<string>(
          (rows as AppointmentRow[])
            .map((row) => row.service_id)
            .filter((id: unknown): id is string => typeof id === "string"),
        ),
      ];

      const [
        { data: patients, error: patientsError },
        { data: services, error: servicesError },
      ] = await Promise.all([
        patientIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, first_name, last_name, date_of_birth, created_at")
              .in("id", patientIds)
          : Promise.resolve({ data: [] as PatientRow[] }),
        serviceIds.length
          ? supabase.from("services").select("id, name_ru").in("id", serviceIds)
          : Promise.resolve({ data: [] as ServiceRow[] }),
      ]);
      if (patientsError) throw patientsError;
      if (servicesError) throw servicesError;

      const patientById = new Map(
        ((patients as PatientRow[]) || []).map((p) => [p.id, p])
      );
      const serviceById = new Map(
        ((services as ServiceRow[]) || []).map((s) => [s.id, s])
      );

      // Determine which patients are "new" — i.e. this is their first
      // appointment with the doctor (no prior appointments before today).
      const newPatientIds = new Set<string>();
      if (patientIds.length) {
        const todayStart = `${yyyyMmDd}T00:00:00`;
        const { data: priorAppts, error: priorAppointmentsError } = await supabase
          .from("appointments")
          .select("patient_id")
          .eq("doctor_id", doctorId)
          .in("patient_id", patientIds)
          .lt("appointment_date", yyyyMmDd);
        if (priorAppointmentsError) throw priorAppointmentsError;
        const seenBefore = new Set(((priorAppts as AppointmentRow[]) || []).map((a) => a.patient_id));
        patientIds.forEach((pid) => {
          if (!seenBefore.has(pid)) newPatientIds.add(pid);
        });
        // Also exclude patients who have an earlier appointment TODAY (not
        // strictly "new" anymore once we've started today's flow).
        const seenIdsToday = new Map<string, string>();
        (rows as AppointmentRow[]).forEach((r) => {
          const prev = seenIdsToday.get(r.patient_id);
          if (!prev || (r.start_time as string) < prev) {
            seenIdsToday.set(r.patient_id, r.start_time);
          }
        });
        // newPatientIds is set; we'll mark only the FIRST appt of the day per
        // new-patient as "Новый" below (handled inline).
        void todayStart;
        void seenIdsToday;
      }

      const firstApptOfDayByPatient = new Map<string, string>(); // patient_id -> first time
      (rows as AppointmentRow[]).forEach((r) => {
        const cur = firstApptOfDayByPatient.get(r.patient_id);
        if (!cur || (r.start_time as string) < cur) {
          firstApptOfDayByPatient.set(r.patient_id, r.start_time);
        }
      });

      return (rows as AppointmentRow[]).map((r) => {
        const p = patientById.get(r.patient_id);
        const s = serviceById.get(r.service_id);
        const fullName =
          (p?.full_name as string) ||
          [p?.last_name, p?.first_name].filter(Boolean).join(" ") ||
          fallbackNoName;
        const start = new Date(`${r.appointment_date}T${r.start_time || "00:00:00"}`);
        const end = new Date(`${r.appointment_date}T${r.end_time || r.start_time || "00:00:00"}`);
        const dur = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
        const isFirstOfDay =
          firstApptOfDayByPatient.get(r.patient_id) === r.start_time;
        const isNew = newPatientIds.has(r.patient_id) && isFirstOfDay;
        return {
          id: r.id,
          time: format(start, "HH:mm"),
          durMin: dur,
          patientName: fullName,
          patientAge: calcAge(p?.date_of_birth),
          type: s?.name_ru || (r.notes as string) || fallbackApptType,
          status: getDoctorMyDayStatus(r.status, start),
          rawStatus: String(r.status ?? ""),
          isNew,
          patientId: r.patient_id,
          rawStart: start,
        };
      });
    },
    enabled: !!doctorId,
  });
}

// ─────────────────────────── row ───────────────────────────

const StatusLabel = ({ s, labels }: { s: ApptStatus; labels: { accepted: string; now: string; next: string } }) => {
  if (s === "done")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
        {labels.accepted}
      </span>
    );
  if (s === "now")
    return (
      <span className="text-xs font-semibold text-primary">
        {labels.now}
      </span>
    );
  if (s === "next")
    return (
      <span className="text-xs font-medium text-status-warning">{labels.next}</span>
    );
  return null;
};

const AppointmentRow = ({
  a,
  onStart,
  onOpen,
  onOpenMedical,
  onCancel,
  actionPending,
  labels,
}: {
  a: ApptVm;
  onStart: () => void;
  onOpen: () => void;
  onOpenMedical: () => void;
  onCancel: () => void;
  actionPending: boolean;
  labels: {
    minSuffix: string;
    yearsShort: string;
    newBadge: string;
    statusAccepted: string;
    statusNow: string;
    statusNext: string;
    continue: string;
    start: string;
    open: string;
    card: string;
    actions: string;
    menuOpenPatient: string;
    menuOpenMedical: string;
    menuCancel: string;
  };
}) => {
  const isLive = a.status === "now";
  const isDone = a.status === "done";
  const isNext = a.status === "next";

  return (
    <div
      className={cn(
        "relative flex flex-wrap items-center gap-3 px-card-x py-card-y border-b border-border/50 last:border-b-0 transition sm:flex-nowrap sm:gap-4",
        isLive ? "bg-primary/10" : "bg-card hover:bg-muted/50",
        isDone && "opacity-55"
      )}
    >
      {isLive && (
        <span
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary"
          aria-hidden
        />
      )}

      <div className="w-[56px] shrink-0">
        <div
          className={cn(
            "font-heading text-base font-semibold tabular-nums",
            isLive ? "text-primary" : "text-foreground"
          )}
        >
          {a.time}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {a.durMin} {labels.minSuffix}
        </div>
      </div>

      <Avatar name={a.patientName} size={36} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "text-base font-semibold truncate",
              isDone ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {a.patientName}
          </div>
          {typeof a.patientAge === "number" && (
            <span className="text-xs text-muted-foreground">· {a.patientAge} {labels.yearsShort}</span>
          )}
          {a.isNew && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-status-info-bg text-status-info ring-1 ring-status-info/40">
              {labels.newBadge}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">{a.type}</div>
      </div>

      <div className="hidden w-[82px] shrink-0 text-right md:block">
        <StatusLabel s={a.status} labels={{ accepted: labels.statusAccepted, now: labels.statusNow, next: labels.statusNext }} />
      </div>

      <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
        {isLive ? (
          <button
            onClick={onStart}
            disabled={actionPending}
            aria-busy={actionPending}
            className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium rounded-prodent-input bg-primary text-primary-foreground shadow-design-btn hover:bg-primary/90 active:scale-[0.98] transition disabled:pointer-events-none disabled:opacity-50"
          >
            <Stethoscope className="w-4 h-4" />
            {labels.continue}
          </button>
        ) : isNext ? (
          <button
            onClick={onStart}
            disabled={actionPending}
            aria-busy={actionPending}
            className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium rounded-prodent-input bg-primary/10 text-primary hover:bg-[hsl(var(--brand-100))] active:scale-[0.98] transition disabled:pointer-events-none disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {labels.start}
          </button>
        ) : !isDone ? (
          <button
            onClick={onOpen}
            className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-prodent-input text-foreground hover:bg-muted transition"
          >
            {labels.open}
          </button>
        ) : (
          <button
            onClick={onOpen}
            className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-prodent-input text-foreground hover:bg-muted transition"
          >
            {labels.card}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid min-h-11 min-w-11 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label={labels.actions}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onOpen} className="gap-2">
              <UserCircle className="h-4 w-4" />
              {labels.menuOpenPatient}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenMedical} className="gap-2">
              <FileTextIcon className="h-4 w-4" />
              {labels.menuOpenMedical}
            </DropdownMenuItem>
            {!isDone && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onCancel}
                  disabled={actionPending}
                  className="gap-2 text-status-danger focus:text-status-danger"
                >
                  <XCircle className="h-4 w-4" />
                  {labels.menuCancel}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// ─────────────────────────── page ───────────────────────────

export default function DoctorMyDay() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quickApptOpen, setQuickApptOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [cancelRequest, setCancelRequest] = useState<ApptVm | null>(null);
  const [filter, setFilter] = useState<MyDayTab>("all");
  const actionLocks = useRef(new Set<string>());
  const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(
    () => new Set(),
  );

  const beginAppointmentAction = (appointmentId: string) => {
    if (actionLocks.current.has(appointmentId)) return false;
    actionLocks.current.add(appointmentId);
    setPendingActionIds((current) => new Set(current).add(appointmentId));
    return true;
  };

  const finishAppointmentAction = (appointmentId: string) => {
    actionLocks.current.delete(appointmentId);
    setPendingActionIds((current) => {
      const next = new Set(current);
      next.delete(appointmentId);
      return next;
    });
  };

  // Tasks aren't wired to a real data source yet. Show an honest empty state
  // instead of inventing patients — the old placeholders referenced fake names
  // ("Алиса Каримова", "Камила Ю."), which a real doctor would mistake for work.
  const placeholderTasks = useMemo<{ t: string; due: string; urgent: boolean }[]>(
    () => [],
    [],
  );

  const {
    data: doctor,
    isLoading: doctorLoading,
    isError: doctorError,
    isFetching: doctorRefreshing,
    refetch: retryDoctor,
  } = useQuery({
    queryKey: ["current-doctor", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: profile } = useQuery({
    queryKey: ["current-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: appointments = [],
    isLoading: appointmentsLoading,
    isError: appointmentsError,
    isFetching: appointmentsRefreshing,
    refetch: retryAppointments,
  } = useTodayAppointments(
    doctor?.id,
    t("doctor.noName"),
    t("doctorMyDay.appointmentType")
  );
  const {
    data: timeRequests = [],
    isLoading: timeRequestsLoading,
    isError: timeRequestsError,
    refetch: refetchTimeRequests,
  } = useQuery({
    queryKey: ["doctor-time-requests", doctor?.id],
    queryFn: getDoctorPendingTimeRequests,
    enabled: Boolean(doctor?.id),
  });
  const isLoading = doctorLoading || appointmentsLoading;
  const scheduleError = doctorError || appointmentsError;
  const scheduleRefreshing = doctorRefreshing || appointmentsRefreshing;
  const retrySchedule = () => {
    if (doctorError) void retryDoctor();
    if (appointmentsError || !doctorError) void retryAppointments();
  };

  const today = getTashkentCalendarDate();
  const dateLabel = format(today, "EEEE · d MMMM", { locale: ru });

  const firstName =
    (profile as DoctorProfileRow | null)?.first_name ||
    (profile as DoctorProfileRow | null)?.full_name?.split(" ")[0] ||
    (user as DoctorUserWithMetadata | null)?.firstName ||
    (user as DoctorUserWithMetadata | null)?.first_name ||
    (user as DoctorUserWithMetadata | null)?.user_metadata?.first_name ||
    (user as DoctorUserWithMetadata | null)?.email?.split("@")[0] ||
    t("doctorMyDay.defaultDoctor");

  const sortedAppts = useMemo(
    () => [...appointments].sort((a, b) => a.rawStart.getTime() - b.rawStart.getTime()),
    [appointments]
  );

  // Filter applied to what the schedule list renders. Status counters in the
  // header still report against the full unfiltered list so the user sees
  // total day stats regardless of which subset is shown.
  const visibleAppts = useMemo(() => {
    // Поле может отсутствовать: ответ приходит с сервера, и его форма
    // не обязана совпадать с нашей моделью. Пустая строка не совпадёт ни с
    // одним срезом — запись просто попадёт только во «Все».
    const raw = (a: ApptVm) => (a.rawStatus ?? "").toLowerCase();
    if (filter === "upcoming") return sortedAppts.filter((a) => a.status !== "done");
    if (filter === "done") return sortedAppts.filter((a) => a.status === "done");
    // Срезы эталона различают состояния, которых нет в укрупнённом status:
    // подтверждённые, ждущие подтверждения и отменённые — это сырой статус.
    if (filter === "confirmed") return sortedAppts.filter((a) => raw(a) === "confirmed");
    if (filter === "pending") return sortedAppts.filter((a) => raw(a) === "pending");
    if (filter === "cancelled") return sortedAppts.filter((a) => raw(a) === "cancelled");
    return sortedAppts;
  }, [sortedAppts, filter]);

  /** Сколько записей в каждом срезе — числа на вкладках, как в макете. */
  const myDayCounts = useMemo(() => {
    // Поле может отсутствовать: ответ приходит с сервера, и его форма
    // не обязана совпадать с нашей моделью. Пустая строка не совпадёт ни с
    // одним срезом — запись просто попадёт только во «Все».
    const raw = (a: ApptVm) => (a.rawStatus ?? "").toLowerCase();
    return {
      all: sortedAppts.length,
      confirmed: sortedAppts.filter((a) => raw(a) === "confirmed").length,
      pending: sortedAppts.filter((a) => raw(a) === "pending").length,
      done: sortedAppts.filter((a) => a.status === "done").length,
      cancelled: sortedAppts.filter((a) => raw(a) === "cancelled").length,
    };
  }, [sortedAppts]);

  const doneCount = sortedAppts.filter((a) => a.status === "done").length;
  const upcomingCount = sortedAppts.filter((a) => a.status !== "done").length;
  const lastTime = sortedAppts.at(-1)?.time || "—";

  const now = sortedAppts.find((a) => a.status === "now");
  const next = sortedAppts.find((a) => a.status === "next");

  // D2: starting a visit transitions the appointment to IN_PROGRESS before
  // navigating, unless it's already terminal. Status is uppercase in the DB
  // (CHECK constraint), and the ApptVm carries a derived bucket ("now"/"done")
  // rather than the raw status, so we re-read the raw row to decide terminality
  // case-insensitively. We don't auto-set IN_PROGRESS on the visit page mount.
  const onStart = async (a: ApptVm) => {
    if (!beginAppointmentAction(a.id)) return;
    try {
      const { data: row, error } = await supabase
        .from("appointments")
        .select("status")
        .eq("id", a.id)
        .maybeSingle();
      if (error) throw error;
      const raw = ((row?.status as string) || "").toLowerCase();
      if (raw === "pending") {
        toast.error(t("doctorMyDay.pendingCannotStart"));
        return;
      }
      const isTerminal = raw === "completed" || raw === "cancelled";
      if (!isTerminal) {
        await updateAppointmentStatus({ appointmentId: a.id, status: "IN_PROGRESS" });
        void queryClient.invalidateQueries({ queryKey: ["doctor-my-day", doctor?.id] });
      }
      navigate(`/doctor/visit/${a.id}`);
    } catch {
      toast.error(t("doctorMyDay.startError") || "Не удалось начать приём");
    } finally {
      finishAppointmentAction(a.id);
    }
  };
  const onOpen = (a: ApptVm) => navigate(`/doctor/patients/${a.patientId}`);
  const onOpenMedical = (a: ApptVm) =>
    navigate(`/doctor/medical-records?id=${a.patientId}`);
  // Two steps: the row asks, the dialog performs. Keeping the request in state
  // means the confirmation is a real, themed, translated dialog instead of the
  // browser's own — which cannot be styled and is silently suppressible.
  const onCancel = (a: ApptVm) => setCancelRequest(a);

  const performCancel = async (a: ApptVm) => {
    setCancelRequest(null);
    if (!beginAppointmentAction(a.id)) return;
    try {
      await cancelAppointment({ appointmentId: a.id });
    } catch {
      toast.error(t("doctorMyDay.cancelError") || "Не удалось отменить приём");
      return;
    } finally {
      finishAppointmentAction(a.id);
    }
    toast.success(t("doctorMyDay.cancelOk") || "Приём отменён");
    void queryClient.invalidateQueries({ queryKey: ["doctor-my-day", doctor?.id] });
  };

  const decideTimeRequest = async (appointmentId: string, accept: boolean) => {
    if (!beginAppointmentAction(appointmentId)) return;
    try {
      if (accept) {
        await updateAppointmentStatus({ appointmentId, status: "CONFIRMED" });
        toast.success(t("doctorMyDay.requestAccepted"));
      } else {
        await cancelAppointment({
          appointmentId,
          reason: t("doctorMyDay.requestRejectedReason"),
        });
        toast.success(t("doctorMyDay.requestRejected"));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["doctor-time-requests", doctor?.id] }),
        queryClient.invalidateQueries({ queryKey: ["doctor-my-day", doctor?.id] }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message || t("doctorMyDay.requestDecisionError"));
    } finally {
      finishAppointmentAction(appointmentId);
    }
  };

  return (
    <DoctorLayout>
      <DoctorTopbar
        title={t("doctorMyDay.title")}
        subtitle={`${dateLabel} · ${currentClinic?.name || t("doctorMyDay.clinic")}`}
      />
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              {dateLabel}
            </div>
            {/* Заголовок экрана по макету: название раздела 20px/700, а не
                приветствие 24px. Класс cabinet-page-title нужен для обоев: с
                ними холст тёмный, и заголовок на нём переключается на светлый.
                Приветствие с именем ушло — раздел называется «Мой день», и на
                рабочем экране это полезнее, чем «Добрый день». */}
            <h1 className="cabinet-page-title mt-1 font-heading text-xl font-bold tracking-tight text-foreground">
              {t("doctorMyDay.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("doctorMyDay.appointmentsAccepted")}{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {doneCount}
              </span>{" "}
              {t("doctorMyDay.appointmentsOf")}{" "}
              <span className="tabular-nums">{sortedAppts.length}</span> · {t("doctorMyDay.appointmentsLeft")}{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {upcomingCount}
              </span>
              , {t("doctorMyDay.lastAt")} {lastTime}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/crm/schedule")}
              className="inline-flex min-h-11 items-center gap-2 px-4 text-base font-medium rounded-prodent-btn border border-border bg-card text-foreground hover:bg-muted/50 transition"
            >
              <CalendarIcon className="w-[18px] h-[18px]" />
              {t("doctorMyDay.week")}
            </button>
            <button
              type="button"
              onClick={() => setBlockOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 px-4 text-base font-medium rounded-prodent-btn border border-border bg-card text-foreground hover:bg-muted/50 transition"
            >
              <Plus className="w-[18px] h-[18px]" />
              {t("doctorMyDay.window")}
            </button>
            <button
              type="button"
              onClick={() => setQuickApptOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 px-4 text-base font-medium rounded-prodent-btn bg-primary text-primary-foreground shadow-design-btn hover:bg-primary/90 transition"
            >
              <Zap className="w-[18px] h-[18px]" />
              {t("doctorMyDay.quickAppointment")}
            </button>
          </div>
        </div>

        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-bold text-foreground">
                {t("doctorMyDay.timeRequestsTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("doctorMyDay.timeRequestsHelp")}
              </p>
            </div>
            {timeRequests.length > 0 && (
              <span className="rounded-full bg-status-warning-bg px-3 py-1 text-sm font-semibold text-status-warning">
                {timeRequests.length}
              </span>
            )}
          </div>
          {timeRequestsLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : timeRequestsError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-status-danger">
              <span>{t("doctorMyDay.timeRequestsLoadError")}</span>
              <button
                type="button"
                onClick={() => void refetchTimeRequests()}
                className="min-h-11 rounded-lg border border-border px-4 font-medium text-foreground"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : timeRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("doctorMyDay.noTimeRequests")}</p>
          ) : (
            <div className="space-y-3">
              {timeRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-status-warning/30 bg-status-warning-bg p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{request.patientName}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {format(new Date(`${request.appointmentDate}T00:00:00`), "d MMMM yyyy", { locale: ru })}
                        {" · "}{request.startTime.slice(0, 5)}
                      </div>
                      <div className="mt-2 rounded-lg bg-background/70 px-3 py-2 text-sm text-foreground">
                        <span className="font-medium">{t("doctorMyDay.requestReason")}:</span>{" "}
                        {request.requestReason}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void decideTimeRequest(request.id, true)}
                        disabled={pendingActionIds.has(request.id)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {t("doctorMyDay.acceptRequest")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void decideTimeRequest(request.id, false)}
                        disabled={pendingActionIds.has(request.id)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-status-danger/40 px-4 font-medium text-status-danger disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        {t("doctorMyDay.rejectRequest")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: schedule */}
          <div className="col-span-12 xl:col-span-8">
            <Card pad="p-0" className="overflow-hidden">
              <div className="flex items-center px-card-x py-card-y border-b border-border/50">
                <div
                  className="font-heading text-base font-bold text-foreground"
                >
                  {t("doctorMyDay.schedule")}
                </div>
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  {/* Срезы дня вкладками, как в макете, вместо выпадающего
                      фильтра: пять состояний видно сразу, вместе с числами, и
                      не нужно открывать меню, чтобы понять, что показано. */}
                  <div className="flex flex-wrap items-center gap-0.5">
                    {([
                      { key: "all" as const, label: t("doctorMyDay.filterAll") || "Все приёмы", n: myDayCounts.all },
                      { key: "confirmed" as const, label: t("doctorMyDay.tabConfirmed"), n: myDayCounts.confirmed },
                      { key: "pending" as const, label: t("doctorMyDay.tabPending"), n: myDayCounts.pending },
                      { key: "done" as const, label: t("doctorMyDay.filterDone") || "Завершены", n: myDayCounts.done },
                      { key: "cancelled" as const, label: t("doctorMyDay.tabCancelled"), n: myDayCounts.cancelled },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setFilter(tab.key)}
                        aria-pressed={filter === tab.key}
                        className={cn(
                          "cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          filter === tab.key
                            ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                            : "font-medium text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {tab.label}
                        {tab.n > 0 && (
                          <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                            {tab.n}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <span className="w-px h-3 bg-muted" />
                  <span className="tabular-nums">
                    {doneCount} / {sortedAppts.length} {t("doctorMyDay.appointmentsCounter")}
                  </span>
                </div>
              </div>
              <div>
                {isLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("doctorMyDay.loadingSchedule")}
                  </div>
                ) : scheduleError ? (
                  <div
                    className="px-4 py-12 text-center"
                    role="alert"
                    data-testid="doctor-my-day-error"
                  >
                    <AlertCircle className="mx-auto mb-3 h-6 w-6 text-status-danger" />
                    <div className="mb-3 text-base font-medium text-foreground">
                      {t("doctorMyDay.loadError") || "Не удалось загрузить расписание"}
                    </div>
                    <button
                      type="button"
                      onClick={retrySchedule}
                      disabled={scheduleRefreshing}
                      className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      {scheduleRefreshing
                        ? t("common.loading")
                        : t("common.retry") || "Повторить"}
                    </button>
                  </div>
                ) : sortedAppts.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <div className="text-base font-medium text-foreground mb-1">
                      {t("doctorMyDay.noAppointmentsToday")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("doctorMyDay.freeDayDesc")}
                    </div>
                  </div>
                ) : (
                  visibleAppts.map((a) => (
                    <AppointmentRow
                      key={a.id}
                      a={a}
                      onStart={() => onStart(a)}
                      onOpen={() => onOpen(a)}
                      onOpenMedical={() => onOpenMedical(a)}
                      onCancel={() => onCancel(a)}
                      actionPending={pendingActionIds.has(a.id)}
                      labels={{
                        minSuffix: t("doctor.min"),
                        yearsShort: t("doctor.yearsShort"),
                        newBadge: t("doctorMyDay.newPatient"),
                        statusAccepted: t("doctorMyDay.accepted"),
                        statusNow: t("doctorMyDay.now"),
                        statusNext: t("doctorMyDay.nextLabel"),
                        continue: t("doctorMyDay.continue"),
                        start: t("doctorMyDay.start"),
                        open: t("doctor.open"),
                        card: t("doctorMyDay.card"),
                        actions: t("doctor.actions"),
                        menuOpenPatient: t("doctorMyDay.menuOpenPatient") || "Открыть пациента",
                        menuOpenMedical: t("doctorMyDay.menuOpenMedical") || "Открыть медкарту",
                        menuCancel: t("doctorMyDay.menuCancel") || "Отменить приём",
                      }}
                    />
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Right: focus panel */}
          <div className="col-span-12 xl:col-span-4 space-y-4">
            {now ? (
              <Card pad="p-0" className="overflow-hidden">
                <div
                  className="px-5 py-3 border-b border-border flex items-center gap-2 bg-primary/10"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    {t("doctorMyDay.onAppointmentNow")}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {now.time} · {now.durMin} {t("doctor.min")}
                  </span>
                </div>

                <div className="p-card-x">
                  <div className="flex items-center gap-3">
                    <Avatar name={now.patientName} size={48} />
                    <div className="min-w-0">
                      <div
                        className="truncate font-heading text-base font-bold text-foreground"
                      >
                        {now.patientName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {typeof now.patientAge === "number" ? `${now.patientAge} ${t("doctor.yearsShort")} · ` : ""}
                        #P-{now.patientId.slice(0, 4).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <dl className="mt-4 text-xs divide-y divide-border border-t border-b border-border">
                    <div className="flex py-2">
                      <dt className="w-[110px] text-muted-foreground">{t("doctorMyDay.procedure")}</dt>
                      <dd className="flex-1 text-foreground font-medium">
                        {now.type}
                      </dd>
                    </div>
                    <div className="flex py-2">
                      <dt className="w-[110px] text-muted-foreground">{t("doctorMyDay.allergies")}</dt>
                      <dd className="flex-1 text-muted-foreground">{t("doctorMyDay.noAllergies")}</dd>
                    </div>
                    <div className="flex py-2">
                      <dt className="w-[110px] text-muted-foreground">{t("doctorMyDay.balance")}</dt>
                      <dd className="flex-1 text-muted-foreground tabular-nums">—</dd>
                    </div>
                    <div className="flex py-2">
                      <dt className="w-[110px] text-muted-foreground">{t("doctorMyDay.nextStep")}</dt>
                      <dd className="flex-1 text-muted-foreground">—</dd>
                    </div>
                  </dl>

                  <button
                    onClick={() => onStart(now)}
                    disabled={pendingActionIds.has(now.id)}
                    aria-busy={pendingActionIds.has(now.id)}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 text-base font-medium rounded-prodent-btn bg-primary text-primary-foreground shadow-design-btn hover:bg-primary/90 transition disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Stethoscope className="w-[18px] h-[18px]" />
                    {t("doctorMyDay.continueAppointment")}
                  </button>

                  {next && (
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t("doctorMyDay.next")}{" "}
                        <span className="font-medium text-foreground">
                          {next.patientName}
                        </span>{" "}
                        · {next.time}
                      </span>
                      <button
                        onClick={() => onOpen(next)}
                        className="text-primary font-medium hover:underline inline-flex items-center gap-0.5"
                      >
                        {t("doctorMyDay.details")}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card pad="p-card-x">
                <div
                  className="mb-1 font-heading text-base font-bold text-foreground"
                >
                  {t("doctorMyDay.noCurrentAppointment")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {next
                    ? `${t("doctorMyDay.nextIs")} ${next.patientName} ${t("doctorMyDay.atTime")} ${next.time}`
                    : t("doctorMyDay.emptyToday")}
                </p>
                {next && (
                  <button
                    onClick={() => onStart(next)}
                    disabled={pendingActionIds.has(next.id)}
                    aria-busy={pendingActionIds.has(next.id)}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 text-base font-medium rounded-prodent-btn bg-primary/10 text-primary hover:bg-[hsl(var(--brand-100))] transition disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Play className="w-[18px] h-[18px]" />
                    {t("doctorMyDay.startNext")}
                  </button>
                )}
              </Card>
            )}

            {/* Tasks */}
            <Card pad="p-0" className="overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center">
                <div
                  className="font-heading text-base font-bold text-foreground"
                >
                  {t("doctorMyDay.tasks")}
                </div>
                <span className="ml-2 text-xs font-semibold px-1.5 rounded-full bg-muted text-muted-foreground tabular-nums">
                  {placeholderTasks.length}
                </span>
                <button
                  onClick={() => navigate("/crm/tasks")}
                  className="ml-auto text-xs text-primary hover:underline"
                >
                  {t("doctorMyDay.allTasks")}
                </button>
              </div>
              <ul>
                {placeholderTasks.length === 0 && (
                  <li className="px-5 py-6 text-center text-xs text-muted-foreground">
                    {t("doctorMyDay.tasksEmpty")}
                  </li>
                )}
                {placeholderTasks.map((x, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 px-5 py-2.5 border-b border-border last:border-b-0 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[hsl(var(--brand))] w-4 h-4 rounded shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground truncate">{x.t}</div>
                      <div
                        className={cn(
                          "text-xs mt-0.5",
                          x.urgent
                            ? "text-status-danger font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {x.due}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDialog

        open={cancelRequest !== null}

        onOpenChange={(open) => !open && setCancelRequest(null)}

        title={t("doctorMyDay.cancelTitle")}

        description={t("doctorMyDay.cancelConfirm").replace("{time}", cancelRequest?.time ?? "")}

        destructive

        onConfirm={() => cancelRequest && void performCancel(cancelRequest)}

      />

      <QuickAppointmentDialog
        open={quickApptOpen}
        onOpenChange={(open) => {
          setQuickApptOpen(open);
          // On close, refetch today's list — picks up the newly created appt.
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ["doctor-my-day", doctor?.id] });
          }
        }}
        selectedDate={today}
      />

      <ScheduleBlockDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        doctorId={doctor?.id}
        selectedDate={today}
      />
    </DoctorLayout>
  );
}
