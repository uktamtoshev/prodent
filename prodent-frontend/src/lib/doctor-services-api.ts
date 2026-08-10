import type { QueryClient } from "@tanstack/react-query";

import {
  ClinicServiceApiError,
  serviceApiRequest,
} from "./clinic-service-management-api";

export interface DoctorServiceWriteInput {
  name: string;
  nameEn?: string | null;
  nameUz?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  descriptionUz?: string | null;
  category?: string | null;
  currency?: "UZS" | "USD";
  price: number;
  durationMinutes?: number;
  isActive?: boolean;
}

export interface DoctorService {
  id: string;
  doctorId: string;
  name: string;
  nameEn: string | null;
  nameUz: string | null;
  description: string | null;
  descriptionEn: string | null;
  descriptionUz: string | null;
  category: string | null;
  currency: "UZS" | "USD";
  price: number;
  durationMinutes: number;
  isActive: boolean;
}

function invalid(reason: string): never {
  throw new ClinicServiceApiError(`Invalid doctor service response: ${reason}`, 502);
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return invalid(`${field} must be a string or null`);
  return value;
}

function normalizeDoctorService(value: unknown): DoctorService {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("service must be an object");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id.trim()) return invalid("id is required");
  if (typeof row.doctorId !== "string" || !row.doctorId.trim()) return invalid("doctorId is required");
  if (typeof row.name !== "string" || !row.name.trim()) return invalid("name is required");
  const price = Number(row.price);
  if (!Number.isFinite(price) || price < 0) return invalid("price must be nonnegative");
  if (typeof row.durationMinutes !== "number" || row.durationMinutes <= 0) {
    return invalid("durationMinutes must be positive");
  }
  if (row.currency !== "UZS" && row.currency !== "USD") {
    return invalid("currency must be UZS or USD");
  }
  if (typeof row.isActive !== "boolean") return invalid("isActive must be boolean");

  return {
    id: row.id,
    doctorId: row.doctorId,
    name: row.name,
    nameEn: nullableString(row.nameEn, "nameEn"),
    nameUz: nullableString(row.nameUz, "nameUz"),
    description: nullableString(row.description, "description"),
    descriptionEn: nullableString(row.descriptionEn, "descriptionEn"),
    descriptionUz: nullableString(row.descriptionUz, "descriptionUz"),
    category: nullableString(row.category, "category"),
    currency: row.currency,
    price,
    durationMinutes: row.durationMinutes,
    isActive: row.isActive,
  };
}

function normalizeDoctorServices(value: unknown): DoctorService[] {
  if (!Array.isArray(value)) return invalid("expected an array");
  return value.map(normalizeDoctorService);
}

function doctorServicesBase(doctorId: string): string {
  return `/api/v1/doctors/${encodeURIComponent(doctorId)}/services`;
}

export async function listManagedDoctorServices(doctorId: string): Promise<DoctorService[]> {
  return normalizeDoctorServices(await serviceApiRequest(
    `${doctorServicesBase(doctorId)}?includeInactive=true`,
    "GET",
  ));
}

export async function createDoctorService(
  doctorId: string,
  input: DoctorServiceWriteInput,
): Promise<DoctorService> {
  return normalizeDoctorService(await serviceApiRequest(doctorServicesBase(doctorId), "POST", input));
}

export async function updateDoctorService(
  doctorId: string,
  doctorServiceId: string,
  input: DoctorServiceWriteInput,
): Promise<DoctorService> {
  return normalizeDoctorService(await serviceApiRequest(
    `${doctorServicesBase(doctorId)}/${encodeURIComponent(doctorServiceId)}`,
    "PUT",
    input,
  ));
}

export async function archiveDoctorService(
  doctorId: string,
  doctorServiceId: string,
): Promise<void> {
  await serviceApiRequest(
    `${doctorServicesBase(doctorId)}/${encodeURIComponent(doctorServiceId)}`,
    "DELETE",
  );
}

export async function invalidateDoctorServiceQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ["doctor-services"] });
}
