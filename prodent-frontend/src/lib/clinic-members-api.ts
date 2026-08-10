const CLINIC_MEMBERS_API_BASE = "/api/v1/clinic-members";
const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

export type ClinicMemberRole = string;

export interface AddClinicMemberCommand {
  clinicId: string;
  userId: string;
  role: ClinicMemberRole;
}

export interface UpdateClinicMemberCommand {
  memberId: string;
  role?: ClinicMemberRole;
  assignedDoctorId?: string | null;
}

export interface RemoveClinicMemberCommand {
  memberId?: string;
  clinicId?: string;
  userId?: string;
  role?: ClinicMemberRole;
}

export interface DoctorDepartureCommand {
  doctorId: string;
  clinicId: string;
}

export interface ClinicMemberCommandResponse {
  id: string;
  clinicId: string;
  userId: string;
  role: ClinicMemberRole;
  assignedDoctorId: string | null;
  active: boolean;
}

export interface ClinicMemberRemoveCommandResponse {
  success: boolean;
  removedMemberId: string;
}

export interface DoctorDepartureResponse {
  success: boolean;
  cooperationType: "staff_doctor" | "chair_rental" | string;
  patientsAffected: number;
  message: string;
}

export class ClinicMembersApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ClinicMembersApiError";
  }
}

function doBackendFetch(path: string, options: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${CLINIC_MEMBERS_API_BASE}${path}`, {
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

async function backendRequest<T>(path: string, body: object): Promise<T> {
  const options: RequestInit = {
    method: "POST",
    body: JSON.stringify(body),
  };
  let response = await doBackendFetch(path, options);
  if (response.status === 401 && (await refreshBackendToken())) {
    response = await doBackendFetch(path, options);
  }

  const text = await response.text();
  let responseBody: unknown = null;
  if (text) {
    try {
      responseBody = JSON.parse(text);
    } catch {
      responseBody = text;
    }
  }

  if (!response.ok) {
    const errorBody = responseBody as { error?: string; message?: string } | null;
    throw new ClinicMembersApiError(
      errorBody?.message || errorBody?.error || `HTTP ${response.status}`,
      response.status,
    );
  }

  return responseBody as T;
}

export function addClinicMember(
  command: AddClinicMemberCommand,
): Promise<ClinicMemberCommandResponse> {
  return backendRequest("/commands/add", command);
}

export function updateClinicMember(
  command: UpdateClinicMemberCommand,
): Promise<ClinicMemberCommandResponse> {
  return backendRequest("/commands/update", command);
}

export function removeClinicMember(
  command: RemoveClinicMemberCommand,
): Promise<ClinicMemberRemoveCommandResponse> {
  return backendRequest("/commands/remove", command);
}

export function departDoctor(
  command: DoctorDepartureCommand,
): Promise<DoctorDepartureResponse> {
  return backendRequest("/commands/doctor-departure", command);
}
