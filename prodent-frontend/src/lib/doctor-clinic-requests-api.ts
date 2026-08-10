import { serviceApiRequest } from "./clinic-service-management-api";

export type DoctorClinicRequestDecision = "accept" | "reject";
export type DoctorClinicRequestStatus = "pending" | "approved" | "rejected";
export type DoctorClinicRequestType =
  | "doctor_to_clinic"
  | "clinic_to_doctor"
  | "doctor_leave_clinic"
  | "clinic_remove_doctor";

export interface CreateDoctorClinicRequestInput {
  doctorId: string;
  clinicId: string;
  requestType: DoctorClinicRequestType;
  message?: string | null;
  cooperationType?: string | null;
  salaryMode?: string | null;
  salaryPercent?: number | null;
  salaryAmount?: number | null;
  rentalFee?: number | null;
  rentalPeriod?: string | null;
}

/**
 * Older rows used upper-case request statuses. Keep reads compatible without
 * rewriting production history or allowing unknown states into UI decisions.
 */
export function normalizeDoctorClinicRequestStatus(
  status: unknown,
): DoctorClinicRequestStatus | null {
  if (typeof status !== "string") return null;

  const normalized = status.trim().toLowerCase();
  return normalized === "pending" ||
    normalized === "approved" ||
    normalized === "rejected"
    ? normalized
    : null;
}

export function hasPendingDoctorClinicRequest(
  requests: ReadonlyArray<{ clinic_id: string; status: string }> | null | undefined,
  clinicId: string,
): boolean {
  return requests?.some(
    (request) =>
      request.clinic_id === clinicId &&
      normalizeDoctorClinicRequestStatus(request.status) === "pending",
  ) ?? false;
}

export async function createDoctorClinicRequest(
  input: CreateDoctorClinicRequestInput,
): Promise<void> {
  await serviceApiRequest("/api/v1/doctor-clinic-requests", "POST", input);
}

export async function cancelDoctorClinicRequest(requestId: string): Promise<void> {
  await serviceApiRequest(
    `/api/v1/doctor-clinic-requests/${encodeURIComponent(requestId)}`,
    "DELETE",
  );
}

/**
 * Atomically decides a pending doctor/clinic request on the server.
 * Accepting may also create or remove the trusted clinic relationship,
 * depending on the request direction and type.
 */
export async function decideDoctorClinicRequest(
  requestId: string,
  decision: DoctorClinicRequestDecision,
  rejectionReason?: string,
): Promise<void> {
  const normalizedReason = rejectionReason?.trim();
  await serviceApiRequest(
    `/api/v1/doctor-clinic-requests/${encodeURIComponent(requestId)}/decision`,
    "POST",
    normalizedReason ? { decision, rejectionReason: normalizedReason } : { decision },
  );
}
