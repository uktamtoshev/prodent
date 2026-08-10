const API_BASE = "/api/v1/medical-access";
const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

export type MedicalAccessStatus = "pending" | "active" | "expired" | "revoked";
export type MedicalAccessSource = "search" | "chat" | "appointment";

export interface MedicalAccessApiRecord {
  id: string;
  patientId: string;
  doctorId: string | null;
  clinicId: string | null;
  source: MedicalAccessSource;
  reason: string;
  validFrom: string;
  validTo: string;
  status: MedicalAccessStatus;
  grantedBy: "patient" | "system" | null;
  patientConsent: boolean;
  patientConsentAt: string | null;
  createdAt: string;
}

export interface MedicalAccessEffectiveApiResponse {
  hasAccess: boolean;
  status: MedicalAccessStatus | "none";
  request: MedicalAccessApiRecord | null;
  requestedAt: string | null;
  expiresAt: string | null;
}

export interface MedicalAccessRequestBody {
  patientId: string;
  source: MedicalAccessSource;
  reason: string;
  durationHours: number;
}

function doFetch(path: string, options: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

async function tryRefresh(): Promise<boolean> {
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response = await doFetch(path, options);
  if (response.status === 401 && (await tryRefresh())) {
    response = await doFetch(path, options);
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
    throw new Error(errorBody?.message || errorBody?.error || `HTTP ${response.status}`);
  }
  return body as T;
}

export const medicalAccessApi = {
  effective: (patientId: string) =>
    request<MedicalAccessEffectiveApiResponse>(
      `/effective?patientId=${encodeURIComponent(patientId)}`,
    ),
  patientRequests: () => request<MedicalAccessApiRecord[]>("/requests/patient"),
  doctorRequests: () => request<MedicalAccessApiRecord[]>("/requests/doctor"),
  patientIds: (statuses: MedicalAccessStatus[] = ["active", "pending"]) =>
    request<string[]>(`/patients?statuses=${encodeURIComponent(statuses.join(","))}`),
  createRequest: (body: MedicalAccessRequestBody) =>
    request<MedicalAccessApiRecord>("/requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  decide: (id: string, approve: boolean, durationHours?: number) =>
    request<MedicalAccessApiRecord>(`/requests/${encodeURIComponent(id)}/decision`, {
      method: "POST",
      body: JSON.stringify({ approve, durationHours }),
    }),
  revoke: (id: string) =>
    request<MedicalAccessApiRecord>(`/requests/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
    }),
  extend: (id: string, additionalHours: number) =>
    request<MedicalAccessApiRecord>(`/requests/${encodeURIComponent(id)}/extend`, {
      method: "POST",
      body: JSON.stringify({ additionalHours }),
    }),
};
