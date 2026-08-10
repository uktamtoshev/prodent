const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

export interface PatientInvoice {
  id: string;
  invoice_number: string | null;
  clinic_id: string;
  appointment_id: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  balance_due: number;
  currency: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientPayment {
  id: string;
  invoice_id: string;
  appointment_id: string | null;
  clinic_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PatientBillingHistory {
  invoices: PatientInvoice[];
  payments: PatientPayment[];
}

export class PatientBillingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PatientBillingApiError";
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    credentials: "omit",
  });
  if (!response.ok) return null;
  const payload = await response.json() as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!payload.access_token) return null;
  localStorage.setItem(TOKEN_KEY, payload.access_token);
  if (payload.refresh_token) localStorage.setItem(REFRESH_KEY, payload.refresh_token);
  return payload.access_token;
}

async function send(token: string) {
  return fetch("/api/v1/payments/patient-history", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
    cache: "no-store",
  });
}

export async function getPatientBillingHistory(): Promise<PatientBillingHistory> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new PatientBillingApiError("AUTH_REQUIRED", 401);
  let response = await send(token);
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send(refreshed);
  }
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new PatientBillingApiError("Invalid server response", response.status || 502);
    }
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object"
      ? String((payload as { message?: unknown }).message ?? `HTTP ${response.status}`)
      : `HTTP ${response.status}`;
    throw new PatientBillingApiError(message, response.status);
  }
  const body = payload as Partial<PatientBillingHistory>;
  return {
    invoices: Array.isArray(body.invoices) ? body.invoices : [],
    payments: Array.isArray(body.payments) ? body.payments : [],
  };
}
