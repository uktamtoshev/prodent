import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Stethoscope,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelAppointment, rescheduleAppointment } from "@/lib/appointment-api";
import { appointmentStartsAt } from "@/lib/patient-cabinet";
import { getTashkentCalendarDate, toCalendarDateKey } from "@/lib/tashkentTime";
import { formatDate, formatTime } from "@/lib/localization";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  notes: string | null;
  total_price: number | null;
  service_id: string | null;
  service: { name_ru: string } | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  doctor: {
    id: string;
    specialty: string;
    user_id: string;
  } | null;
  clinic: {
    name: string;
    address: string;
  } | null;
}

type TabKey = "upcoming" | "past" | "cancelled";

const PatientAppointments = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<TabKey>("upcoming");

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [historyAppointment, setHistoryAppointment] = useState<Appointment | null>(null);
  const fetchSequence = useRef(0);

  const fetchAppointments = useCallback(async (background = false) => {
    const requestId = ++fetchSequence.current;
    const patientId = user?.id;
    if (!patientId) {
      setAppointments([]);
      setDoctorNames({});
      setLoading(false);
      return;
    }
    if (!background) setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `id, appointment_date, start_time, end_time, status, notes, total_price, service_id,
           cancel_reason, cancelled_at, confirmed_at, completed_at, created_at,
           service:services(name_ru),
           doctor:doctors(id, specialty, user_id),
           clinic:clinics(name, address)`
        )
        .eq("patient_id", patientId)
        .order("appointment_date", { ascending: false });

      if (error) throw error;
      if (requestId !== fetchSequence.current) return;

      const rows = (data || []) as unknown as Appointment[];
      const names: Record<string, string> = {};

      const doctorUserIds = rows.flatMap((appointment) =>
        appointment.doctor?.user_id ? [appointment.doctor.user_id] : [],
      );

      if (doctorUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", doctorUserIds);
        if (profilesError) throw profilesError;
        if (requestId !== fetchSequence.current) return;

        profiles?.forEach((p) => {
          names[p.id] = p.full_name || "";
        });
      }

      setAppointments(rows);
      setDoctorNames(names);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      if (requestId === fetchSequence.current) setLoadError(true);
    } finally {
      if (requestId === fetchSequence.current && !background) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  const handleCancelAppointment = async () => {
    if (!cancellingId) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error(t("patientCabinet.cancelReasonRequired"));
      return;
    }
    const appointmentId = cancellingId;
    setCancelSubmitting(true);
    try {
      await cancelAppointment({
        appointmentId,
        reason,
      });
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === appointmentId
            ? {
                ...appointment,
                status: "CANCELLED",
                cancel_reason: reason,
                cancelled_at: new Date().toISOString(),
              }
            : appointment,
        ),
      );
      toast.success(t("patientCabinet.appointmentCancelled"));
      setCancelDialogOpen(false);
      setCancellingId(null);
      setCancelReason("");
      void fetchAppointments(true);
    } catch {
      toast.error(t("patientCabinet.cancelError"));
    } finally {
      setCancelSubmitting(false);
    }
  };

  const openCancelDialog = (id: string) => {
    setCancellingId(id);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const openRescheduleDialog = (appointment: Appointment) => {
    setRescheduling(appointment);
    setRescheduleDate(appointment.appointment_date);
    setRescheduleTime(appointment.start_time?.slice(0, 5) || "");
  };

  const handleReschedule = async () => {
    if (!rescheduling || !rescheduleDate || !rescheduleTime) return;
    const appointment = rescheduling;
    const appointmentId = appointment.id;
    const nextDate = rescheduleDate;
    const nextTime = rescheduleTime;
    setRescheduleSubmitting(true);
    try {
      await rescheduleAppointment({
        appointmentId,
        appointmentDate: nextDate,
        startTime: nextTime,
        notes: appointment.notes,
      });
      setAppointments((current) =>
        current.map((row) =>
          row.id === appointmentId
            ? {
                ...row,
                appointment_date: nextDate,
                start_time: nextTime,
              }
            : row,
        ),
      );
      toast.success(t("patientCabinet.appointmentRescheduled"));
      setRescheduling(null);
      void fetchAppointments(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("patientCabinet.rescheduleError"),
      );
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const rebook = (appointment: Appointment) => {
    if (!appointment.doctor?.id) return;
    const params = new URLSearchParams();
    if (appointment.service_id) params.set("service", appointment.service_id);
    navigate(`/book/${appointment.doctor.id}?${params.toString()}`);
  };

  const { upcoming, past, cancelled } = useMemo(() => {
    const now = Date.now();
    // Status comparisons are case-insensitive — DB stores enum-style UPPERCASE
    // but historical records may have lowercase values.
    const norm = (s: string) => (s ?? "").toLowerCase();
    const upcoming = appointments
      .filter(
        (a) =>
          appointmentStartsAt(a.appointment_date, a.start_time).getTime() >= now &&
          (norm(a.status) === "pending" || norm(a.status) === "confirmed")
      )
      .sort(
        (a, b) =>
          new Date(a.appointment_date).getTime() -
          new Date(b.appointment_date).getTime()
      );
    const past = appointments.filter(
      (a) =>
        norm(a.status) === "completed" ||
        (appointmentStartsAt(a.appointment_date, a.start_time).getTime() < now &&
          norm(a.status) !== "cancelled")
    );
    const cancelled = appointments.filter((a) => norm(a.status) === "cancelled");
    return { upcoming, past, cancelled };
  }, [appointments]);

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--brand))]" aria-hidden="true" />
            <span>{t("common.loading")}</span>
          </div>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="mx-auto max-w-[1100px] p-4 sm:p-6">
        {loadError && (
          <div
            className="mb-4 flex flex-col gap-3 rounded-xl border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>{t("common.error")}</span>
            <Button
              className="min-h-11 w-full sm:w-auto"
              variant="outline"
              onClick={() => void fetchAppointments()}
            >
              {t("common.retry")}
            </Button>
          </div>
        )}
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[12.5px] text-muted-foreground">{t("patientCabinet.visits")}</div>
            <h2 className="font-heading text-[24px] font-bold tracking-tight text-foreground">
              {t("patientCabinet.myAppointments")}
            </h2>
          </div>
          <button
            onClick={() => navigate("/patient/book")}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {t("patientCabinet.bookShort")}
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex max-w-full items-center gap-1 overflow-x-auto rounded-[10px] bg-muted p-1">
          {(
            [
              { k: "upcoming" as const, label: `${t("patientCabinet.tabUpcoming")} · ${upcoming.length}` },
              { k: "past" as const, label: `${t("patientCabinet.tabPast")} · ${past.length}` },
              { k: "cancelled" as const, label: `${t("patientCabinet.tabCancelled")} · ${cancelled.length}` },
            ]
          ).map((tt) => (
            <button
              key={tt.k}
              type="button"
              data-testid={`patient-appointments-tab-${tt.k}`}
              aria-pressed={tab === tt.k}
              onClick={() => setTab(tt.k)}
              className={cn(
                "min-h-11 shrink-0 rounded-[7px] px-3.5 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === tt.k
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tt.label}
            </button>
          ))}
        </div>

        {tab === "upcoming" && (
          <div className="space-y-3">
            {upcoming.length > 0 ? (
              <>
                {upcoming.map((apt) => (
                  <UpcomingCard
                    key={apt.id}
                    apt={apt}
                    doctorName={doctorNames[apt.doctor?.user_id ?? ""] || ""}
                    onReschedule={() => openRescheduleDialog(apt)}
                    onCancel={() => openCancelDialog(apt.id)}
                  />
                ))}
                <button
                  onClick={() => navigate("/patient/book")}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-border py-6 text-[13.5px] font-medium text-muted-foreground transition hover:border-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-4 w-4" />
                  {t("patientCabinet.bookNewAppointment")}
                </button>
              </>
            ) : (
              <EmptyState
                icon={<CalendarIcon className="h-10 w-10 text-muted-foreground" />}
                title={t("patientCabinet.noUpcomingApp")}
                subtitle={t("patientCabinet.noUpcomingAppDesc")}
                ctaLabel={t("patientCabinet.bookAppointment")}
                onCta={() => navigate("/patient/book")}
              />
            )}
          </div>
        )}

        {tab === "past" && (
          <PastTable
            items={past}
            doctorNames={doctorNames}
            onRowClick={setHistoryAppointment}
            onRebook={rebook}
          />
        )}

        {tab === "cancelled" && (
          <div className="rounded-[14px] border border-border bg-card p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            {cancelled.length > 0 ? (
              <PastTable
                items={cancelled}
                doctorNames={doctorNames}
                variant="cancelled"
                onRowClick={setHistoryAppointment}
                onRebook={rebook}
              />
            ) : (
              <div className="text-[13px] text-muted-foreground">
                {t("patientCabinet.cancelledAppears")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel-with-reason dialog (required textarea) */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
        setCancelDialogOpen(open);
        if (!open) { setCancellingId(null); setCancelReason(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("patientCabinet.cancelAppointmentTitle")}</DialogTitle>
            <DialogDescription>
              {t("patientCabinet.cancelAppointmentDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              {t("patientCabinet.cancelReasonLabel")}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              data-testid="patient-cancel-reason"
              autoFocus
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t("patientCabinet.cancelReasonPlaceholder")}
              rows={3}
              className="min-h-11 resize-none"
            />
          </div>
          <DialogFooter>
            <Button className="min-h-11" variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelSubmitting}>
              {t("patientCabinet.noShort")}
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              data-testid="patient-cancel-confirm"
              onClick={handleCancelAppointment}
              disabled={cancelSubmitting || !cancelReason.trim()}
            >
              {cancelSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("patientCabinet.yesCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rescheduling)}
        onOpenChange={(open) => {
          if (!open) setRescheduling(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("patientCabinet.reschedule")}</DialogTitle>
            <DialogDescription>
              {t("patientCabinet.chooseNewDateTime")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">{t("patientCabinet.colDate")}</Label>
              <Input
                id="reschedule-date"
                type="date"
                min={toCalendarDateKey(getTashkentCalendarDate())}
                value={rescheduleDate}
                onChange={(event) => setRescheduleDate(event.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">{t("patientCabinet.time")}</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={rescheduleTime}
                onChange={(event) => setRescheduleTime(event.target.value)}
                className="min-h-11"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setRescheduling(null)}
              disabled={rescheduleSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="min-h-11"
              data-testid="patient-reschedule-confirm"
              onClick={handleReschedule}
              disabled={rescheduleSubmitting || !rescheduleDate || !rescheduleTime}
            >
              {rescheduleSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog (timeline of appointment events) */}
      <HistoryDialog
        appointment={historyAppointment}
        doctorName={historyAppointment ? (doctorNames[historyAppointment.doctor?.user_id ?? ""] || "—") : ""}
        onClose={() => setHistoryAppointment(null)}
      />
    </PatientLayout>
  );
};

// ───────────────────────── HistoryDialog ─────────────────────────
interface HistoryDialogProps {
  appointment: Appointment | null;
  doctorName: string;
  onClose: () => void;
}

const HistoryDialog = ({ appointment, doctorName, onClose }: HistoryDialogProps) => {
  const { language, t } = useLanguage();
  if (!appointment) return null;

  const fmt = (iso: string | null) =>
    iso
      ? `${formatDate(iso, language, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })} · ${formatTime(iso, language)}`
      : null;

  const events: { label: string; ts: string | null; extra?: string }[] = [
    { label: t("patientCabinet.historyCreated"), ts: appointment.created_at },
    { label: t("patientCabinet.historyConfirmed"), ts: appointment.confirmed_at },
    { label: t("patientCabinet.historyCompleted"), ts: appointment.completed_at },
    {
      label: t("patientCabinet.historyCancelled"),
      ts: appointment.cancelled_at,
      extra: appointment.cancel_reason ?? undefined,
    },
  ].filter((e) => e.ts);

  return (
    <Dialog open={!!appointment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment.service?.name_ru || t("patientCabinet.visit")}</DialogTitle>
          <DialogDescription>
            {formatDate(`${appointment.appointment_date}T00:00:00`, language, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {appointment.start_time ? ` · ${appointment.start_time.slice(0, 5)}` : ""}
            {doctorName && ` · ${doctorName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">{t("patientCabinet.historyChanges")}</h4>
          <ol className="relative space-y-3 border-l-2 border-border pl-4">
            {events.map((ev, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand))]" />
                <div className="text-[13px] font-medium text-foreground">{ev.label}</div>
                <div className="text-xs text-muted-foreground">{fmt(ev.ts)}</div>
                {ev.extra && (
                  <div className="mt-1 rounded-md bg-muted px-3 py-2 text-[12.5px] text-foreground">
                    {t("patientCabinet.historyReason")}: {ev.extra}
                  </div>
                )}
              </li>
            ))}
          </ol>

          {appointment.notes && (
            <div className="rounded-md bg-muted p-3 text-[12.5px] text-foreground">
              <div className="mb-0.5 font-medium text-muted-foreground">{t("patientCabinet.notes")}</div>
              {appointment.notes}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button className="min-h-11" variant="outline" onClick={onClose}>{t("patientCabinet.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Real visit length from start/end. Returns null when we can't compute it, so
// the UI can hide the duration instead of inventing a hardcoded "60 мин".
function visitDurationMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins : null;
}

// ───────────────────────── UpcomingCard ─────────────────────────
interface UpcomingCardProps {
  apt: Appointment;
  doctorName: string;
  onReschedule: () => void;
  onCancel: () => void;
}

const UpcomingCard = ({ apt, doctorName, onReschedule, onCancel }: UpcomingCardProps) => {
  const { t } = useLanguage();
  const WEEKDAYS = t("patientCabinet.weekdaysShort").split(",");
  const MONTHS_SHORT = t("patientCabinet.monthsShort").split(",");
  // Parse the date string as LOCAL parts — `new Date("2026-12-23")` is parsed as
  // UTC midnight, which in +05 renders as 05:00 (and can shift the day in
  // negative-offset zones). The time must come from start_time, not the date.
  const [yy, mm, dd0] = apt.appointment_date.split("-").map(Number);
  const date = new Date(yy, (mm || 1) - 1, dd0 || 1);
  const dd = String(date.getDate()).padStart(2, "0");
  const mon = MONTHS_SHORT[date.getMonth()];
  const dow = WEEKDAYS[date.getDay()];
  const time = apt.start_time ? apt.start_time.slice(0, 5) : "—";
  const dur = visitDurationMinutes(apt.start_time, apt.end_time);

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      data-testid="patient-appointment-card"
      data-appointment-id={apt.id}
      data-appointment-status={apt.status.toLowerCase()}
    >
      <div className="grid grid-cols-1 md:grid-cols-[110px_1fr_auto]">
        <div className="border-b border-border bg-muted/40 text-center md:border-b-0 md:border-r">
          <div
            className="bg-[hsl(var(--brand))] py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground"
          >
            {dow}
          </div>
          <div className="py-3">
            <div className="font-heading text-[32px] font-bold leading-none tabular-nums text-foreground">
              {dd}
            </div>
            <div className="mt-0.5 text-xs uppercase text-muted-foreground">{mon}</div>
            <div className="mt-2.5 text-xs tabular-nums text-muted-foreground">{time}</div>
            {dur != null && (
              <div className="text-xs text-muted-foreground">{dur} {t("patientCabinet.durationMin")}</div>
            )}
          </div>
        </div>

        <div className="min-w-0 p-4">
          <div className="flex items-center gap-2">
            {apt.status.toLowerCase() === "confirmed" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--success-green)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--success-green))] ring-1 ring-[hsl(var(--success-green)/0.3)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success-green))]" />
                {t("patientCabinet.confirmedStatus")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--warning-amber)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--warning-amber))] ring-1 ring-[hsl(var(--warning-amber)/0.3)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning-amber))]" />
                {t("patientCabinet.pendingStatus")}
              </span>
            )}
          </div>
          <div className="mt-2 font-heading text-[17px] font-bold tracking-tight text-foreground">
            {apt.service?.name_ru || t("patientCabinet.visit")}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-foreground">
            {doctorName && (
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                {doctorName}
                {apt.doctor?.specialty && (
                  <span className="text-muted-foreground">· {apt.doctor.specialty}</span>
                )}
              </span>
            )}
            {apt.clinic?.name && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {apt.clinic.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 p-4 sm:flex-row sm:items-center md:flex-col md:items-end">
          <button
            data-testid="patient-appointment-reschedule"
            onClick={onReschedule}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {t("patientCabinet.reschedule")}
          </button>
          <button
            data-testid="patient-appointment-cancel"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium text-destructive hover:bg-[hsl(var(--destructive)/0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
            {t("patientCabinet.cancelButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────── PastTable ─────────────────────────
const PastTable = ({
  items,
  doctorNames,
  variant = "past",
  onRowClick,
  onRebook,
}: {
  items: Appointment[];
  doctorNames: Record<string, string>;
  variant?: "past" | "cancelled";
  onRowClick?: (apt: Appointment) => void;
  onRebook?: (apt: Appointment) => void;
}) => {
  const { language, t } = useLanguage();
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-10 w-10 text-muted-foreground" />}
        title={t("patientCabinet.historyEmpty")}
        subtitle={t("patientCabinet.historyEmptyDesc")}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="hidden grid-cols-[110px_1fr_180px_260px] border-b border-border bg-muted/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
        <div>{t("patientCabinet.colDate")}</div>
        <div>{t("patientCabinet.colVisit")}</div>
        <div>{t("patientCabinet.colDoctor")}</div>
        <div className="text-center">{t("patientCabinet.colStatus")}</div>
      </div>
      {items.map((v) => {
        const dateShort = formatDate(
          `${v.appointment_date}T00:00:00`,
          language,
          { day: "2-digit", month: "2-digit", year: "2-digit" },
        );
        const docName = doctorNames[v.doctor?.user_id ?? ""] || "—";
        return (
          <div
            key={v.id}
            data-testid="patient-appointment-row"
            data-appointment-id={v.id}
            data-appointment-status={v.status.toLowerCase()}
            className="grid grid-cols-1 items-center gap-2 border-b border-border px-4 py-4 text-left last:border-b-0 hover:bg-muted/60 sm:px-5 md:grid-cols-[110px_1fr_180px_260px] md:gap-0"
          >
            <div className="text-[13px] tabular-nums text-muted-foreground">
              {dateShort}
            </div>
            <div className="truncate pr-3 text-[13.5px] font-medium text-foreground">
              {v.service?.name_ru || t("patientCabinet.visit")}
            </div>
            <div className="text-[12.5px] text-muted-foreground">{docName}</div>
            <div className="flex flex-wrap items-center gap-2 md:justify-center">
              {variant === "cancelled" ? (
                <span className="inline-flex items-center rounded-full bg-[hsl(var(--destructive)/0.1)] px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-[hsl(var(--destructive)/0.3)]">
                  {t("patientCabinet.statusCancelled")}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[hsl(var(--success-green)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--success-green))] ring-1 ring-[hsl(var(--success-green)/0.3)]">
                  {t("patientCabinet.statusCompleted")}
                </span>
              )}
              {onRowClick && (
                <button
                  type="button"
                  onClick={() => onRowClick(v)}
                  className="min-h-11 rounded-md px-3 py-1 text-xs font-medium text-[hsl(var(--brand-700))] hover:bg-[hsl(var(--brand-50))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("patientCabinet.historyChanges")}
                </button>
              )}
              {onRebook && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRebook(v);
                  }}
                  className="min-h-11 rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("patientCabinet.bookAgain")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────── EmptyState ─────────────────────────
const EmptyState = ({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
}) => (
  <div className="rounded-[14px] border border-border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
    <div className="mx-auto mb-3 grid h-10 w-10 place-items-center">{icon}</div>
    <div className="font-heading text-[16px] font-semibold text-foreground">{title}</div>
    <div className="mt-1 text-[13px] text-muted-foreground">{subtitle}</div>
    {ctaLabel && onCta && (
      <button
        onClick={onCta}
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" />
        {ctaLabel}
      </button>
    )}
  </div>
);

export default PatientAppointments;
