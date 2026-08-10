import { supabase } from "@/integrations/supabase/client";

const APPOINTMENTS_API_BASE = "/api/v1/appointments";
const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

export interface GuestPatientCommand {
  id?: string;
  name: string;
  phone: string;
  comment?: string;
  smsConsent?: boolean;
}

export interface CreateAppointmentCommand {
  patientId?: string;
  guestPatient?: GuestPatientCommand;
  doctorId: string;
  clinicId?: string;
  serviceId?: string;
  serviceName?: string;
  appointmentDate: string;
  startTime: string;
  notes?: string;
}

export interface AppointmentStatusCommand {
  appointmentId: string;
  status: string;
}

export interface CancelAppointmentCommand {
  appointmentId: string;
  reason?: string;
}

export interface RescheduleAppointmentCommand {
  appointmentId: string;
  appointmentDate: string;
  startTime: string;
  notes?: string | null;
}

export interface PlaceAppointmentCommand {
  appointmentId: string;
  doctorId?: string;
  roomId?: string | null;
  appointmentDate: string;
  startTime: string;
  notes?: string;
}

export interface UpdateGuestPatientCommand {
  guestPatientId: string;
  name: string;
  phone: string;
  comment: string | null;
  smsConsent: boolean;
}

export interface GuestPatientSearchItem {
  id: string;
  clinicId: string;
  name: string;
  phone: string;
  comment: string | null;
  smsConsent: boolean;
  status: string;
}

export interface GuestInvitationPreparedResponse {
  guestPatientId: string;
  clinicId: string;
  phone: string;
  status: "invitation_prepared";
  deliveryStatus: "not_sent";
  invitationToken: string;
  preparedAt: string;
}

export interface AppointmentCommandResponse {
  id: string;
  patientId: string | null;
  patientName: string | null;
  doctorId: string;
  doctorName: string | null;
  clinicId: string;
  clinicName: string | null;
  serviceId: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  timeRequest: boolean;
  requestReason: string | null;
  totalPrice: number | null;
  currency: string | null;
  createdAt: string;
}

export interface DoctorMyDayAppointment {
  id: string;
  patientId: string | null;
  guestPatientId: string | null;
  patientName: string | null;
  serviceId: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
}

export class AppointmentApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "AppointmentApiError";
  }
}

function doBackendFetch(path: string, options: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${APPOINTMENTS_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

async function refreshBackendToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;

  try {
    const response = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;

    const body = await response.json();
    const accessToken = body.access_token ?? body.token ?? body.data?.access_token;
    if (!accessToken) return false;

    localStorage.setItem(TOKEN_KEY, accessToken);
    const nextRefreshToken = body.refresh_token ?? body.data?.refresh_token;
    if (nextRefreshToken) localStorage.setItem(REFRESH_KEY, nextRefreshToken);
    return true;
  } catch {
    return false;
  }
}

async function backendRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response = await doBackendFetch(path, options);
  if (response.status === 401 && (await refreshBackendToken())) {
    response = await doBackendFetch(path, options);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const errorBody = body as { error?: string; message?: string } | null;
    throw new AppointmentApiError(
      errorBody?.message || errorBody?.error || `HTTP ${response.status}`,
      response.status,
    );
  }

  return body as T;
}

async function invokeAppointmentCommand<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw new AppointmentApiError(error.message, error.status);
  }
  return data as T;
}

export function createAppointment(
  command: CreateAppointmentCommand,
): Promise<AppointmentCommandResponse> {
  return invokeAppointmentCommand("appointment-create", { ...command });
}

export function updateAppointmentStatus(
  command: AppointmentStatusCommand,
): Promise<AppointmentCommandResponse> {
  return invokeAppointmentCommand("appointment-status", { ...command });
}

export function cancelAppointment(
  command: CancelAppointmentCommand,
): Promise<AppointmentCommandResponse> {
  return invokeAppointmentCommand("appointment-cancel", { ...command });
}

export function rescheduleAppointment(
  command: RescheduleAppointmentCommand,
): Promise<AppointmentCommandResponse> {
  return backendRequest<AppointmentCommandResponse>(
    `/${encodeURIComponent(command.appointmentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        appointmentDate: command.appointmentDate,
        startTime: command.startTime,
        notes: command.notes ?? null,
      }),
    },
  );
}

export function placeAppointment(
  command: PlaceAppointmentCommand,
): Promise<AppointmentCommandResponse> {
  return invokeAppointmentCommand("appointment-place", { ...command });
}

export function updateGuestPatient(
  command: UpdateGuestPatientCommand,
): Promise<void> {
  return invokeAppointmentCommand("appointment-guest-update", { ...command });
}

export function searchGuestPatients(
  clinicId: string,
  phone: string,
  signal?: AbortSignal,
): Promise<GuestPatientSearchItem[]> {
  const params = new URLSearchParams({ clinicId, phone });
  return backendRequest<GuestPatientSearchItem[]>(
    `/commands/guest/search?${params.toString()}`,
    { signal },
  );
}

export function prepareGuestInvitation(
  guestPatientId: string,
): Promise<GuestInvitationPreparedResponse> {
  return backendRequest<GuestInvitationPreparedResponse>(
    "/commands/guest/invitation/prepare",
    {
      method: "POST",
      body: JSON.stringify({ guestPatientId }),
    },
  );
}

export function getDoctorMyDayAppointments(): Promise<DoctorMyDayAppointment[]> {
  return backendRequest<DoctorMyDayAppointment[]>("/doctor/my-day");
}

export function getDoctorPendingTimeRequests(): Promise<AppointmentCommandResponse[]> {
  return backendRequest<AppointmentCommandResponse[]>("/doctor/time-requests");
}

export async function completeAppointment(appointmentId: string): Promise<void> {
  await invokeAppointmentCommand("finish-visit", {
    appointmentId,
    diagnosis: null,
    anesthesia: null,
    notes: null,
  });
}

export async function setAppointmentStatus(
  command: AppointmentStatusCommand & { reason?: string },
): Promise<void> {
  const status = command.status.toUpperCase();
  if (status === "COMPLETED") {
    await completeAppointment(command.appointmentId);
    return;
  }
  if (status === "CANCELLED") {
    await cancelAppointment({
      appointmentId: command.appointmentId,
      reason: command.reason,
    });
    return;
  }
  await updateAppointmentStatus({ appointmentId: command.appointmentId, status });
}
