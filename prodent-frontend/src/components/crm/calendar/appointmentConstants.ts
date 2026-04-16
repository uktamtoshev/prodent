// Appointment status types and styling constants
// Based on existing database enum: pending, confirmed, completed, cancelled
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export const APPOINTMENT_STATUSES: Record<AppointmentStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  pending: {
    label: 'Новая',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    borderColor: 'border-blue-400',
  },
  confirmed: {
    label: 'Подтверждена',
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/50',
    borderColor: 'border-indigo-400',
  },
  completed: {
    label: 'Завершена',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-950/50',
    borderColor: 'border-green-400',
  },
  cancelled: {
    label: 'Отменена',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-950/50',
    borderColor: 'border-red-400',
  },
};

export const getStatusStyle = (status: string) => {
  return APPOINTMENT_STATUSES[status as AppointmentStatus] || APPOINTMENT_STATUSES.pending;
};

export interface AppointmentData {
  id: string;
  appointment_date: string;
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

// Styles for personal patient appointments (chair_rental doctors)
export const PERSONAL_PATIENT_STYLE = {
  label: 'Личный пациент',
  sublabel: 'Вне кассы клиники',
  color: 'text-amber-700 dark:text-amber-300',
  bgColor: 'bg-amber-50 dark:bg-amber-950/50',
  borderColor: 'border-amber-500',
  badgeBg: 'bg-amber-500/10',
  badgeText: 'text-amber-600 dark:text-amber-400',
  badgeBorder: 'border-amber-500/30',
};

export const CLINIC_PATIENT_STYLE = {
  label: 'Клиника',
  color: 'text-primary',
  bgColor: 'bg-primary/5',
  borderColor: 'border-primary/30',
  badgeBg: 'bg-primary/10',
  badgeText: 'text-primary',
  badgeBorder: 'border-primary/30',
};

// Styles for guest patient appointments
export const GUEST_PATIENT_STYLE = {
  label: 'Гость',
  sublabel: 'Без регистрации',
  color: 'text-slate-600 dark:text-slate-400',
  bgColor: 'bg-slate-50 dark:bg-slate-900/50',
  borderColor: 'border-slate-400',
  badgeBg: 'bg-slate-100 dark:bg-slate-800',
  badgeText: 'text-slate-600 dark:text-slate-400',
  badgeBorder: 'border-slate-300 dark:border-slate-600',
};
