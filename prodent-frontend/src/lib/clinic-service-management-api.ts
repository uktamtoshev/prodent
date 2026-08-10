import type { QueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

export type ClinicServiceCurrency = "UZS" | "USD";

export interface ClinicServiceWriteInput {
  nameRu: string;
  nameUz?: string | null;
  nameUzCyrl?: string | null;
  nameKz?: string | null;
  nameKg?: string | null;
  nameTj?: string | null;
  descriptionRu?: string | null;
  descriptionUz?: string | null;
  descriptionUzCyrl?: string | null;
  descriptionKz?: string | null;
  descriptionKg?: string | null;
  descriptionTj?: string | null;
  category?: string | null;
  price: number;
  currency?: ClinicServiceCurrency;
  duration?: number;
  isActive?: boolean;
}

export interface ClinicService {
  id: string;
  nameRu: string;
  nameUz: string | null;
  nameUzCyrl: string | null;
  nameKz: string | null;
  nameKg: string | null;
  nameTj: string | null;
  descriptionRu: string | null;
  descriptionUz: string | null;
  descriptionUzCyrl: string | null;
  descriptionKz: string | null;
  descriptionKg: string | null;
  descriptionTj: string | null;
  category: string | null;
  price: number;
  currency: ClinicServiceCurrency;
  duration: number;
  isActive: boolean;
}

export interface LegacyClinicServiceView {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  currency: ClinicServiceCurrency;
  canonical: ClinicService;
}

export class ClinicServiceApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ClinicServiceApiError";
  }
}

export const CLINIC_SERVICE_MANAGEMENT_QUERY_KEY = "clinic-services-management";

const SERVICE_QUERY_ROOTS = [
  CLINIC_SERVICE_MANAGEMENT_QUERY_KEY,
  "clinic-public-services",
  "clinic-services",
  "services",
  "treatment-plan-service-options",
  "quick-procedure-service-options",
] as const;

export async function invalidateClinicServiceQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all(SERVICE_QUERY_ROOTS.map((root) =>
    queryClient.invalidateQueries({ queryKey: [root] })));
}

function serviceBase(clinicId: string): string {
  return `/api/v1/clinics/${encodeURIComponent(clinicId)}/services`;
}

function authenticatedOptions(method: string, body?: unknown): RequestInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

async function refreshAccessToken(): Promise<boolean> {
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

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function serviceApiRequest(
  path: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  let response = await fetch(path, authenticatedOptions(method, body));
  if (response.status === 401 && (await refreshAccessToken())) {
    response = await fetch(path, authenticatedOptions(method, body));
  }

  const responseBody = await readResponse(response);
  if (!response.ok) {
    const errorBody = responseBody as { message?: string; error?: string } | null;
    throw new ClinicServiceApiError(
      errorBody?.message || errorBody?.error || `HTTP ${response.status}`,
      response.status,
    );
  }
  return responseBody;
}

function invalidServicePayload(reason: string): never {
  throw new ClinicServiceApiError(`Invalid clinic service response: ${reason}`, 502);
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") invalidServicePayload(`${field} must be a string or null`);
  return value;
}

function normalizeClinicService(value: unknown): ClinicService {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalidServicePayload("service must be an object");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id.trim()) {
    return invalidServicePayload("id is required");
  }
  if (typeof row.nameRu !== "string" || !row.nameRu.trim()) {
    return invalidServicePayload("nameRu is required");
  }
  const price = typeof row.price === "number" || typeof row.price === "string"
    ? Number(row.price)
    : Number.NaN;
  if (!Number.isFinite(price) || price < 0) {
    return invalidServicePayload("price must be finite and nonnegative");
  }
  if (typeof row.duration !== "number" || !Number.isFinite(row.duration) || row.duration <= 0) {
    return invalidServicePayload("duration must be positive");
  }
  if (row.currency !== "UZS" && row.currency !== "USD") {
    return invalidServicePayload("currency is not supported");
  }
  if (typeof row.isActive !== "boolean") {
    return invalidServicePayload("isActive must be boolean");
  }

  return {
    id: row.id,
    nameRu: row.nameRu,
    nameUz: nullableString(row.nameUz, "nameUz"),
    nameUzCyrl: nullableString(row.nameUzCyrl, "nameUzCyrl"),
    nameKz: nullableString(row.nameKz, "nameKz"),
    nameKg: nullableString(row.nameKg, "nameKg"),
    nameTj: nullableString(row.nameTj, "nameTj"),
    descriptionRu: nullableString(row.descriptionRu, "descriptionRu"),
    descriptionUz: nullableString(row.descriptionUz, "descriptionUz"),
    descriptionUzCyrl: nullableString(row.descriptionUzCyrl, "descriptionUzCyrl"),
    descriptionKz: nullableString(row.descriptionKz, "descriptionKz"),
    descriptionKg: nullableString(row.descriptionKg, "descriptionKg"),
    descriptionTj: nullableString(row.descriptionTj, "descriptionTj"),
    category: nullableString(row.category, "category"),
    price,
    currency: row.currency,
    duration: row.duration,
    isActive: row.isActive,
  };
}

function normalizeList(body: unknown): ClinicService[] {
  if (!Array.isArray(body)) return invalidServicePayload("expected an array");
  return body.map(normalizeClinicService);
}

export function toLegacyClinicService(service: ClinicService): LegacyClinicServiceView {
  return {
    id: service.id,
    name: service.nameRu,
    description: service.descriptionRu,
    category: service.category ?? "",
    price: Number(service.price),
    duration_minutes: service.duration,
    is_active: service.isActive,
    currency: service.currency,
    canonical: service,
  };
}

export async function listManagedClinicServices(clinicId: string): Promise<ClinicService[]> {
  return normalizeList(await serviceApiRequest(`${serviceBase(clinicId)}?includeInactive=true`, "GET"));
}

/** Public, cache-backed catalog. The server returns active, non-archived rows only. */
export async function listPublicClinicServices(clinicId: string): Promise<ClinicService[]> {
  return normalizeList(await serviceApiRequest(serviceBase(clinicId), "GET"));
}

export async function createClinicService(
  clinicId: string,
  input: ClinicServiceWriteInput,
): Promise<ClinicService> {
  return normalizeClinicService(await serviceApiRequest(serviceBase(clinicId), "POST", input));
}

export async function updateClinicService(
  clinicId: string,
  serviceId: string,
  input: ClinicServiceWriteInput,
): Promise<ClinicService> {
  return normalizeClinicService(await serviceApiRequest(
    `${serviceBase(clinicId)}/${encodeURIComponent(serviceId)}`,
    "PUT",
    input,
  ));
}

export async function bulkCreateClinicServices(
  clinicId: string,
  services: ClinicServiceWriteInput[],
): Promise<ClinicService[]> {
  return normalizeList(await serviceApiRequest(
    `${serviceBase(clinicId)}/commands/bulk-create`,
    "POST",
    { services },
  ));
}

export async function setClinicServicesActive(
  clinicId: string,
  serviceIds: string[],
  isActive: boolean,
): Promise<ClinicService[]> {
  return normalizeList(await serviceApiRequest(
    `${serviceBase(clinicId)}/commands/bulk-status`,
    "POST",
    { serviceIds, isActive },
  ));
}

export async function archiveClinicService(clinicId: string, serviceId: string): Promise<void> {
  await serviceApiRequest(`${serviceBase(clinicId)}/${encodeURIComponent(serviceId)}`, "DELETE");
}

export async function archiveClinicServices(clinicId: string, serviceIds: string[]): Promise<void> {
  await serviceApiRequest(
    `${serviceBase(clinicId)}/commands/bulk-delete`,
    "POST",
    { serviceIds },
  );
}
