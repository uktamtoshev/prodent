import type { QueryClient } from "@tanstack/react-query";

import {
  ClinicServiceApiError,
  serviceApiRequest,
} from "./clinic-service-management-api";

export interface ClinicServiceDoctorAssignment {
  id: string;
  clinicId: string;
  serviceId: string;
  doctorId: string;
  customPrice: number | null;
  isActive: boolean;
}

export interface DesiredDoctorAssignment {
  doctorId: string;
  customPrice?: number | null;
}

function invalid(reason: string): never {
  throw new ClinicServiceApiError(`Invalid service assignment response: ${reason}`, 502);
}

function normalizeAssignment(value: unknown): ClinicServiceDoctorAssignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("assignment must be an object");
  }
  const row = value as Record<string, unknown>;
  for (const field of ["id", "clinicId", "serviceId", "doctorId"] as const) {
    if (typeof row[field] !== "string" || !(row[field] as string).trim()) {
      return invalid(`${field} is required`);
    }
  }
  const customPrice = row.customPrice === null || row.customPrice === undefined
    ? null
    : Number(row.customPrice);
  if (customPrice !== null && (!Number.isFinite(customPrice) || customPrice < 0)) {
    return invalid("customPrice must be null or nonnegative");
  }
  if (typeof row.isActive !== "boolean") return invalid("isActive must be boolean");

  return {
    id: row.id as string,
    clinicId: row.clinicId as string,
    serviceId: row.serviceId as string,
    doctorId: row.doctorId as string,
    customPrice,
    isActive: row.isActive,
  };
}

function normalizeAssignments(value: unknown): ClinicServiceDoctorAssignment[] {
  if (!Array.isArray(value)) return invalid("expected an array");
  return value.map(normalizeAssignment);
}

function assignmentBase(clinicId: string): string {
  return `/api/v1/clinics/${encodeURIComponent(clinicId)}`;
}

export async function listClinicServiceDoctorAssignments(
  clinicId: string,
  serviceId?: string,
): Promise<ClinicServiceDoctorAssignment[]> {
  const query = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : "";
  return normalizeAssignments(await serviceApiRequest(
    `${assignmentBase(clinicId)}/service-doctor-assignments${query}`,
    "GET",
  ));
}

export async function syncClinicServiceDoctorAssignments(
  clinicId: string,
  serviceId: string,
  assignments: DesiredDoctorAssignment[],
): Promise<ClinicServiceDoctorAssignment[]> {
  return normalizeAssignments(await serviceApiRequest(
    `${assignmentBase(clinicId)}/services/${encodeURIComponent(serviceId)}/doctor-assignments`,
    "PUT",
    { assignments },
  ));
}

export async function invalidateClinicServiceAssignmentQueries(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    "service-doctor-assignments",
    "service-assignments",
    "doctor-clinic-services",
  ].map((root) => queryClient.invalidateQueries({ queryKey: [root] })));
}
