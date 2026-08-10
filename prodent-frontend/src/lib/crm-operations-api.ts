const API_ROOT = "/api/v1";
const TOKEN_KEY = "prodent_access_token";
const REQUEST_ID_PREFIX = "prodent:s7:request:";

type JsonRecord = Record<string, unknown>;

export class CrmApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "CrmApiError";
  }
}

const record = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;

async function crmFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers });
  const raw = await response.text();
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    body = raw;
  }
  if (!response.ok) {
    const payload = record(body);
    throw new CrmApiError(
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : response.statusText || "CRM request failed",
      response.status,
      typeof payload?.code === "string" ? payload.code : undefined,
      payload?.details ?? body,
    );
  }
  return body as T;
}

function clinicPath(clinicId: string, suffix: string) {
  return `/crm/clinics/${encodeURIComponent(clinicId)}${suffix}`;
}

function query(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function getPersistentClientRequestId(
  userId: string,
  clinicId: string,
  actionKey: string,
): string {
  const storageKey = `${REQUEST_ID_PREFIX}${userId}:${clinicId}:${actionKey}`;
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const id =
    globalThis.crypto?.randomUUID?.() ??
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  localStorage.setItem(storageKey, id);
  return id;
}

export function clearPersistentClientRequestId(
  userId: string,
  clinicId: string,
  actionKey: string,
) {
  localStorage.removeItem(`${REQUEST_ID_PREFIX}${userId}:${clinicId}:${actionKey}`);
}

export interface ScheduleResult {
  appointments?: JsonRecord[];
  doctors?: JsonRecord[];
  rooms?: JsonRecord[];
  chairs?: JsonRecord[];
  [key: string]: unknown;
}

/**
 * Staff view of a doctor's free slots.
 *
 * Not the public /public/doctors/{id}/availability endpoint: that one enforces
 * the ONLINE booking policy — it requires a service, honours
 * online_booking_enabled and the advance-booking limit. Staff writes are
 * validated WITHOUT that policy (validateSlot(..., false)), so a staff UI
 * reading the public view would hide slots the server accepts, and 400
 * entirely while no service is picked yet.
 */
export interface DoctorAvailabilitySlot {
  startTime: string;
  endTime: string;
}

export interface DoctorAvailability {
  doctorId: string;
  clinicId: string;
  serviceId: string | null;
  timezone: string;
  date: string;
  durationMinutes: number;
  slots: DoctorAvailabilitySlot[];
}

export function getDoctorAvailability(
  clinicId: string,
  doctorId: string,
  date: string,
  serviceId?: string,
) {
  return crmFetch<DoctorAvailability>(
    clinicPath(
      clinicId,
      `/doctors/${encodeURIComponent(doctorId)}/availability${query(
        serviceId ? { date, serviceId } : { date },
      )}`,
    ),
  );
}

export function getClinicSchedule(clinicId: string, from: string, to: string) {
  return crmFetch<ScheduleResult>(
    clinicPath(clinicId, `/schedule${query({ from, to })}`),
  );
}

export function replaceDoctorSchedule(
  clinicId: string,
  doctorId: string,
  days: JsonRecord[],
) {
  return crmFetch<JsonRecord>(
    clinicPath(clinicId, `/doctor-schedules/${encodeURIComponent(doctorId)}`),
    { method: "PUT", body: JSON.stringify({ days }) },
  );
}

export function bulkAppointments(
  clinicId: string,
  clientRequestId: string,
  operations: JsonRecord[],
) {
  return crmFetch<JsonRecord>(clinicPath(clinicId, "/appointments/bulk"), {
    method: "POST",
    body: JSON.stringify({ clientRequestId, operations }),
  });
}

export function getClinicQueue(clinicId: string, date: string) {
  return crmFetch<JsonRecord[]>(
    clinicPath(clinicId, `/queue${query({ date })}`),
  );
}

export type QueueAction = "arrive" | "reorder" | "call" | "start" | "complete";

export function queueCommand(
  clinicId: string,
  action: QueueAction,
  command: {
    clientRequestId: string;
    appointmentId?: string;
    queueEntryId?: string;
    queueNumber?: number;
    expectedVersion?: number;
  },
) {
  return crmFetch<JsonRecord>(
    clinicPath(clinicId, `/queue/commands/${action}`),
    { method: "POST", body: JSON.stringify(command) },
  );
}

export function searchClinicPatients(clinicId: string, search = "") {
  return crmFetch<JsonRecord[]>(
    clinicPath(clinicId, `/patients/search${query({ q: search })}`),
  );
}

export function listDuplicatePatients(clinicId: string) {
  return crmFetch<JsonRecord[]>(
    clinicPath(clinicId, "/patients/duplicates"),
  );
}

export interface PatientMergeCommand {
  clientRequestId: string;
  survivorGuestId: string;
  duplicateGuestIds: string[];
}

export function mergeDuplicatePatients(
  clinicId: string,
  command: PatientMergeCommand,
) {
  return crmFetch<JsonRecord>(clinicPath(clinicId, "/patients/merge"), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export interface InvoiceCommand {
  clientRequestId: string;
  patientId: string;
  appointmentId?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  dueDate?: string;
  notes?: string;
}

export function createClinicInvoice(clinicId: string, command: InvoiceCommand) {
  return crmFetch<JsonRecord>(clinicPath(clinicId, "/invoices"), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function listClinicInvoices(clinicId: string) {
  return crmFetch<JsonRecord[]>(clinicPath(clinicId, "/invoices"));
}

export interface ClinicPaymentCommand {
  clientRequestId: string;
  invoiceId: string;
  amount: number;
  method: string;
  notes?: string;
}

export function createClinicPayment(
  clinicId: string,
  command: ClinicPaymentCommand,
) {
  return crmFetch<JsonRecord>(clinicPath(clinicId, "/payments"), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function refundClinicPayment(
  clinicId: string,
  paymentId: string,
  command: { clientRequestId: string; amount: number; reason: string },
) {
  return crmFetch<JsonRecord>(
    clinicPath(
      clinicId,
      `/payments/${encodeURIComponent(paymentId)}/refunds`,
    ),
    { method: "POST", body: JSON.stringify(command) },
  );
}

export function listClinicDebts(clinicId: string) {
  return crmFetch<JsonRecord[]>(clinicPath(clinicId, "/debts"));
}

export function getReportSummary(
  clinicId: string,
  from: string,
  to: string,
) {
  return crmFetch<JsonRecord>(
    clinicPath(clinicId, `/reports/summary${query({ from, to })}`),
  );
}

export function listReportOperations(
  clinicId: string,
  params: { from: string; to: string; cursor?: string; size?: number },
) {
  return crmFetch<JsonRecord[]>(
    clinicPath(clinicId, `/reports/operations${query(params)}`),
  );
}

export function listClinicTasks(clinicId: string) {
  return crmFetch<JsonRecord[]>(clinicPath(clinicId, "/tasks"));
}

export function createClinicTask(clinicId: string, command: JsonRecord) {
  return crmFetch<JsonRecord>(clinicPath(clinicId, "/tasks"), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function updateClinicTask(
  clinicId: string,
  taskId: string,
  command: JsonRecord,
) {
  return crmFetch<JsonRecord>(
    clinicPath(clinicId, `/tasks/${encodeURIComponent(taskId)}`),
    { method: "PUT", body: JSON.stringify(command) },
  );
}

export function deleteClinicTask(
  clinicId: string,
  taskId: string,
  expectedVersion: number,
) {
  return crmFetch<void>(
    clinicPath(
      clinicId,
      `/tasks/${encodeURIComponent(taskId)}${query({ expectedVersion })}`,
    ),
    { method: "DELETE" },
  );
}

export function inviteClinicStaff(
  clinicId: string,
  command: {
    clientRequestId: string;
    contact: string;
    role: string;
    expiresInHours?: number;
  },
) {
  return crmFetch<JsonRecord>(clinicPath(clinicId, "/staff-invitations"), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export interface ClinicStaffInvitation {
  id: string;
  clinic_id: string;
  contact: string;
  role: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
  expires_at: string;
  created_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
  cancelled_at?: string | null;
  resend_count?: number;
  last_sent_at?: string | null;
  version?: number;
  token?: string;
  acceptPath?: string;
}

export function listClinicStaffInvitations(
  clinicId: string,
  params: { status?: string; size?: number } = { size: 50 },
) {
  return crmFetch<ClinicStaffInvitation[]>(
    clinicPath(clinicId, `/staff-invitations${query(params)}`),
  );
}

export function resendClinicStaffInvitation(
  clinicId: string,
  invitationId: string,
  command: { clientRequestId: string; expiresInHours?: number },
) {
  return crmFetch<ClinicStaffInvitation>(
    clinicPath(clinicId, `/staff-invitations/${encodeURIComponent(invitationId)}/resend`),
    { method: "POST", body: JSON.stringify(command) },
  );
}

export function cancelClinicStaffInvitation(
  clinicId: string,
  invitationId: string,
  command: { clientRequestId: string },
) {
  return crmFetch<ClinicStaffInvitation>(
    clinicPath(clinicId, `/staff-invitations/${encodeURIComponent(invitationId)}/cancel`),
    { method: "POST", body: JSON.stringify(command) },
  );
}

export function decideStaffInvitation(
  token: string,
  decision: "accept" | "decline",
) {
  return crmFetch<JsonRecord>(
    `/staff-invitations/${encodeURIComponent(token)}/${decision}`,
    { method: "POST" },
  );
}
