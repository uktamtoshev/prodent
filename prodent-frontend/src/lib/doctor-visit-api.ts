const API_BASE = "/api/v1/appointments";
const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

export interface VisitDocument {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  authorUserId: string;
  status: "DRAFT" | "FINAL";
  version: number;
  diagnosis: string | null;
  treatment: string | null;
  anesthesia: string | null;
  notes: string | null;
  privateNotes: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replayed: boolean;
}

export interface VisitVersion {
  id: string;
  version: number;
  authorUserId: string;
  status: "DRAFT" | "FINAL";
  diagnosis: string | null;
  treatment: string | null;
  anesthesia: string | null;
  notes: string | null;
  privateNotes: string | null;
  finalizedAt: string | null;
  createdAt: string;
}

export interface SaveVisitDraftRequest {
  expectedVersion: number;
  diagnosis: string | null;
  treatment: string | null;
  anesthesia: string | null;
  notes: string | null;
  privateNotes: string | null;
}

export interface AddVisitFileRequest {
  file_name: string;
  storage_key: string;
  content_type: string | null;
  size_bytes: number;
}

export class DoctorVisitApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DoctorVisitApiError";
  }
}

async function refreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  const body = await response.json() as {
    access_token?: string;
    token?: string;
    refresh_token?: string;
    data?: { access_token?: string; refresh_token?: string };
  };
  const accessToken = body.access_token ?? body.token ?? body.data?.access_token;
  if (!accessToken) return null;
  localStorage.setItem(TOKEN_KEY, accessToken);
  const nextRefresh = body.refresh_token ?? body.data?.refresh_token;
  if (nextRefresh) localStorage.setItem(REFRESH_KEY, nextRefresh);
  return accessToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const firstToken = localStorage.getItem(TOKEN_KEY);
  if (!firstToken) throw new DoctorVisitApiError("AUTH_REQUIRED", 401);
  const send = (token: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      credentials: "omit",
      cache: "no-store",
    });

  let response = await send(firstToken);
  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) response = await send(refreshed);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new DoctorVisitApiError("Invalid server response", response.status || 502);
    }
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object"
        ? String(
            (body as { message?: unknown; error?: unknown }).message
              ?? (body as { error?: unknown }).error
              ?? `HTTP ${response.status}`,
          )
        : `HTTP ${response.status}`;
    throw new DoctorVisitApiError(message, response.status);
  }
  return body as T;
}

export function getVisitDocument(appointmentId: string): Promise<VisitDocument> {
  return request<VisitDocument>(`/${encodeURIComponent(appointmentId)}/visit`);
}

export function saveVisitDraft(
  appointmentId: string,
  body: SaveVisitDraftRequest,
): Promise<VisitDocument> {
  return request<VisitDocument>(
    `/${encodeURIComponent(appointmentId)}/visit/draft`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function getVisitHistory(recordId: string): Promise<VisitVersion[]> {
  return request<VisitVersion[]>(
    `/visit-records/${encodeURIComponent(recordId)}/history`,
  );
}

export function addVisitFile(
  recordId: string,
  body: AddVisitFileRequest,
): Promise<{ id: string }> {
  return request<{ id: string }>(
    `/visit-records/${encodeURIComponent(recordId)}/files`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
