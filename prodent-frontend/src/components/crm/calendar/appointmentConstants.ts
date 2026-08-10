// Appointment status types and styling constants
// Based on existing database enum: pending, confirmed, completed, cancelled, no_show
// NOTE: map keys stay lowercase (reused by guest/legacy flows); the DB stores
// UPPERCASE values, so all lookups must be made case-insensitive.
import {
  Check,
  CheckCircle2,
  Clock,
  Play,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { languageRuntime } from "@/i18n/language-runtime";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

/** Which semantic token family a status paints itself with. */
type StatusTone = "neutral" | "info" | "brand" | "success" | "danger" | "warning";

const TONE_CLASSES: Record<
  StatusTone,
  { color: string; bgColor: string; borderColor: string }
> = {
  neutral: {
    color: "text-status-neutral",
    bgColor: "bg-status-neutral-bg",
    borderColor: "border-status-neutral",
  },
  info: {
    color: "text-status-info",
    bgColor: "bg-status-info-bg",
    borderColor: "border-status-info",
  },
  brand: {
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary",
  },
  success: {
    color: "text-status-success",
    bgColor: "bg-status-success-bg",
    borderColor: "border-status-success",
  },
  danger: {
    color: "text-status-danger",
    bgColor: "bg-status-danger-bg",
    borderColor: "border-status-danger",
  },
  warning: {
    color: "text-status-warning",
    bgColor: "bg-status-warning-bg",
    borderColor: "border-status-warning",
  },
};

function defineStatus(
  labelKey: string,
  icon: LucideIcon,
  tone: StatusTone,
): AppointmentStatusStyle {
  return {
    labelKey,
    icon,
    get label() {
      return languageRuntime.translate(labelKey);
    },
    ...TONE_CLASSES[tone],
  };
}

export interface AppointmentStatusStyle {
  /** i18n key. Use this when you have a `t()` to hand. */
  labelKey: string;
  /**
   * Human-readable label in the ACTIVE language.
   *
   * A getter, not a stored string: this map is a module-level constant read from
   * 16 places across 7 components, and the labels used to be hardcoded Russian —
   * so an Uzbek clinic saw "Подтверждена" on its own schedule. Resolving through
   * the translation runtime on access keeps every one of those call sites
   * correct without threading `t` through all of them.
   */
  readonly label: string;
  /** Icon, so the status never depends on colour alone (WCAG 1.4.1). */
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Appointment statuses.
 *
 * Colours were Tailwind palette classes (blue / indigo / violet / green / red /
 * amber). Two problems: the same status looked different between the calendar
 * and the list, and this file was the hole through which the palette reached
 * `AppointmentListItem` and `DraggableAppointmentCard` — the two components
 * whose contract test forbids palette classes. Forbidding them in the component
 * while importing them from here proved nothing.
 *
 * The mapping is chosen so a scheduler can learn to read the day at a glance:
 *   pending      neutral   nothing is wrong yet, it just needs confirming
 *   confirmed    info      locked in
 *   in_progress  brand     happening NOW — the one state worth the brand colour
 *   completed    success   done
 *   cancelled    danger    will not happen
 *   no_show      warning   a problem that already cost the clinic money
 *
 * `completed` deliberately gets success rather than neutral: the scheduler's
 * question at the end of a shift is "did everything happen?", and a green row
 * answers it. `pending` is the neutral one because "new" is the default state of
 * every appointment and colouring it would make a normal day look busy.
 */
export const APPOINTMENT_STATUSES: Record<
  AppointmentStatus,
  AppointmentStatusStyle
> = {
  pending: defineStatus("crmTopLevel.statusNew", Clock, "neutral"),
  confirmed: defineStatus("crmTopLevel.statusConfirmed", CheckCircle2, "info"),
  in_progress: defineStatus("crmTopLevel.statusInProgressAppt", Play, "brand"),
  completed: defineStatus("crmTopLevel.statusCompleted", Check, "success"),
  cancelled: defineStatus("crmTopLevel.statusCancelled", XCircle, "danger"),
  no_show: defineStatus("crmTopLevel.statusNoShowAppt", UserX, "warning"),
};

export const getStatusStyle = (status: string) => {
  return (
    APPOINTMENT_STATUSES[
      (status || "").toLowerCase() as AppointmentStatus
    ] || APPOINTMENT_STATUSES.pending
  );
};

export const normalizeAppointmentStatus = (
  status: string,
): AppointmentStatus => {
  const normalized = (status || "").toLowerCase() as AppointmentStatus;
  return normalized in APPOINTMENT_STATUSES ? normalized : "pending";
};

export const appointmentMatchesStatus = (
  status: string,
  selectedStatus: string,
) => {
  return (
    selectedStatus === "all" ||
    normalizeAppointmentStatus(status) === selectedStatus.toLowerCase()
  );
};

export const getAppointmentTime = (
  appointment: Pick<AppointmentData, "appointment_date" | "start_time">,
) => {
  if (appointment.start_time) return appointment.start_time.slice(0, 5);
  const fallback = new Date(appointment.appointment_date);
  return Number.isNaN(fallback.getTime())
    ? "00:00"
    : `${String(fallback.getHours()).padStart(2, "0")}:${String(
        fallback.getMinutes(),
      ).padStart(2, "0")}`;
};

export const getAppointmentHour = (
  appointment: Pick<AppointmentData, "appointment_date" | "start_time">,
) => {
  return Number.parseInt(getAppointmentTime(appointment).slice(0, 2), 10);
};

export interface AppointmentData {
  id: string;
  appointment_date: string;
  start_time?: string | null;
  room_id?: string | null;
  service: string;
  status: string;
  notes?: string | null;
  doctor_id: string;
  patient_id: string | null;
  guest_patient_id?: string | null;
  price?: number | null;
  isPersonalPatient?: boolean; // Patient of chair_rental doctor
  isGuestPatient?: boolean; // Guest patient without registration
  profiles?: {
    full_name: string | null;
    phone: string | null;
  } | null;
  guest_patients?: {
    id: string;
    name: string;
    phone: string;
    status: string;
  } | null;
  doctors?: {
    profiles?: {
      full_name: string | null;
    } | null;
    cooperation_type?: string | null;
  } | null;
}

/**
 * Who the appointment belongs to. Same getter trick as the statuses above, for
 * the same reason: the labels were hardcoded Russian in a six-language product.
 *
 * A chair-rental doctor's own patient is `warning`, not decoration: the money
 * for that visit does not pass through the clinic's till, and that is exactly
 * what the administrator needs to notice in a shared schedule.
 */
export const PERSONAL_PATIENT_STYLE = {
  get label() {
    return languageRuntime.translate("crmApptOwner.personal");
  },
  get sublabel() {
    return languageRuntime.translate("crmApptOwner.personalHint");
  },
  color: "text-status-warning",
  bgColor: "bg-status-warning-bg",
  borderColor: "border-status-warning",
  badgeBg: "bg-status-warning-bg",
  badgeText: "text-status-warning",
  badgeBorder: "border-status-warning/30",
};

export const CLINIC_PATIENT_STYLE = {
  get label() {
    return languageRuntime.translate("crmApptOwner.clinic");
  },
  color: "text-primary",
  bgColor: "bg-primary/5",
  borderColor: "border-primary/30",
  badgeBg: "bg-primary/10",
  badgeText: "text-primary",
  badgeBorder: "border-primary/30",
};

export const GUEST_PATIENT_STYLE = {
  get label() {
    return languageRuntime.translate("crmApptOwner.guest");
  },
  get sublabel() {
    return languageRuntime.translate("crmApptOwner.guestHint");
  },
  color: "text-status-neutral",
  bgColor: "bg-status-neutral-bg",
  borderColor: "border-status-neutral",
  badgeBg: "bg-status-neutral-bg",
  badgeText: "text-status-neutral",
  badgeBorder: "border-status-neutral/40",
};
