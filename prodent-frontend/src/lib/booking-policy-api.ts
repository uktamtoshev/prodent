export interface ClinicBookingPolicy {
  clinicId: string;
  onlineBookingEnabled: boolean;
  maxAdvanceBookingDays: number;
}

const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;

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
}

async function postPolicy(
  policy: ClinicBookingPolicy,
): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch("/api/v1/clinic-settings/commands/booking-policy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(policy),
  });
}

export async function getClinicBookingPolicy(
  clinicId: string,
): Promise<ClinicBookingPolicy> {
  const params = new URLSearchParams({ clinicId });
  const response = await fetch(
    `/api/v1/clinic-settings/booking-policy?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? body?.error ?? `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as ClinicBookingPolicy;
}

export async function updateClinicBookingPolicy(
  policy: ClinicBookingPolicy,
): Promise<ClinicBookingPolicy> {
  let response = await postPolicy(policy);
  if (response.status === 401 && (await refreshAccessToken())) {
    response = await postPolicy(policy);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? body?.error ?? `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as ClinicBookingPolicy;
}
