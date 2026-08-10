import { supabase } from "@/integrations/supabase/client";

export interface DentalChartItem {
  id: string;
  patientId: string;
  clinicId: string | null;
  doctorId: string | null;
  toothNumber: number;
  status: string;
  formulaType: string;
  materials: string | null;
  notes: string | null;
  recommendations: string | null;
  images: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface DentalChartResponse {
  patientId: string;
  items: DentalChartItem[];
}

export interface ToothHistoryItem {
  id: string;
  statusBefore: string | null;
  statusAfter: string;
  procedureName: string | null;
  notes: string | null;
  images: string[] | null;
  appointmentId: string | null;
  doctorId: string | null;
  doctorName: string | null;
  clinicId: string | null;
  clinicName: string | null;
  createdAt: string;
}

export interface ToothHistoryPage {
  patientId: string;
  toothNumber: number;
  items: ToothHistoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface ToothHistoryOptions {
  limit?: number;
  cursor?: string | null;
  signal?: AbortSignal;
}

export class DentalChartApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "DentalChartApiError";
  }
}

function parseError(response: Response, body: unknown): string {
  if (body && typeof body === "object") {
    const payload = body as {
      message?: unknown;
      error?: unknown | { message?: unknown };
    };
    if (typeof payload.message === "string") return payload.message;
    if (
      payload.error
      && typeof payload.error === "object"
      && "message" in payload.error
      && typeof payload.error.message === "string"
    ) return payload.error.message;
    if (typeof payload.error === "string") return payload.error;
  }
  return response.statusText;
}

interface AuthenticatedJsonResponse {
  response: Response;
  body: unknown;
}

async function authenticatedJsonGet(
  url: string,
  signal?: AbortSignal,
): Promise<AuthenticatedJsonResponse> {
  const requestController = new AbortController();
  let rejectCancellation: (reason?: unknown) => void = () => undefined;
  const cancellation = new Promise<never>((_, reject) => {
    rejectCancellation = reject;
  });
  const cancel = (reason: unknown) => {
    const error = reason instanceof Error
      ? reason
      : new DOMException("Dental chart request was cancelled", "AbortError");
    requestController.abort(error);
    rejectCancellation(error);
  };
  const relayAbort = () => cancel(signal?.reason);
  if (signal?.aborted) relayAbort();
  else signal?.addEventListener("abort", relayAbort, { once: true });
  const timeout = window.setTimeout(() => {
    cancel(new DOMException("Dental chart request timed out", "TimeoutError"));
  }, 20_000);

  try {
    const operation = async (): Promise<AuthenticatedJsonResponse> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new DentalChartApiError("AUTH_REQUIRED", 401);

      let response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: requestController.signal,
      });

      if (response.status === 401) {
        await supabase.auth.getUser();
        const refreshed = await supabase.auth.getSession();
        const refreshedToken = refreshed.data.session?.access_token;
        if (refreshedToken && refreshedToken !== token) {
          response = await fetch(url, {
            headers: { Authorization: `Bearer ${refreshedToken}` },
            signal: requestController.signal,
          });
        }
      }

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // The response validator below handles an empty or malformed JSON body.
      }
      return { response, body };
    };

    return await Promise.race([operation(), cancellation]);
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", relayAbort);
  }
}

export async function getDentalChart(
  patientId: string,
  signal?: AbortSignal,
): Promise<DentalChartResponse> {
  const url = `/api/v1/dental-chart/patients/${encodeURIComponent(patientId)}`;
  const { response, body } = await authenticatedJsonGet(url, signal);

  if (!response.ok) {
    throw new DentalChartApiError(parseError(response, body), response.status);
  }

  const payload = body as DentalChartResponse;
  if (payload?.patientId !== patientId || !Array.isArray(payload.items)) {
    throw new Error("INVALID_DENTAL_CHART_RESPONSE");
  }

  return payload;
}

export async function getToothHistory(
  patientId: string,
  toothNumber: number,
  options: ToothHistoryOptions = {},
): Promise<ToothHistoryPage> {
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const params = new URLSearchParams({ limit: String(limit) });
  if (options.cursor) params.set("cursor", options.cursor);

  const url = `/api/v1/dental-chart/patients/${encodeURIComponent(patientId)}`
    + `/teeth/${encodeURIComponent(String(toothNumber))}/history?${params.toString()}`;
  const { response, body } = await authenticatedJsonGet(url, options.signal);

  if (!response.ok) {
    throw new DentalChartApiError(parseError(response, body), response.status);
  }

  const payload = body as ToothHistoryPage;
  if (
    payload?.patientId !== patientId
    || payload?.toothNumber !== toothNumber
    || !Array.isArray(payload.items)
  ) {
    throw new Error("INVALID_TOOTH_HISTORY_RESPONSE");
  }

  return payload;
}
