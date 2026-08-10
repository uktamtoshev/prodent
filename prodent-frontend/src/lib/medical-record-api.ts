import { supabase } from "@/integrations/supabase/client";

export interface MedicalRecordApiItem {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  appointmentId: string | null;
  diagnosis: string | null;
  treatment: string | null;
  anesthesia: string | null;
  notes: string | null;
  createdAt: string;
}

export class MedicalRecordApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "MedicalRecordApiError";
  }
}

async function parseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function authenticatedGet(url: string): Promise<Response> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new MedicalRecordApiError("AUTH_REQUIRED", 401);

  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    await supabase.auth.getUser();
    const refreshed = await supabase.auth.getSession();
    const refreshedToken = refreshed.data.session?.access_token;
    if (refreshedToken && refreshedToken !== token) {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${refreshedToken}` },
      });
    }
  }
  return response;
}

export async function getPatientMedicalRecords(
  patientId: string,
): Promise<MedicalRecordApiItem[]> {
  const response = await authenticatedGet(
    `/api/v1/medical-records/patient/${encodeURIComponent(patientId)}`,
  );
  const body = await parseBody(response);
  if (!response.ok) {
    const responseBody = body as { message?: string; error?: string } | null;
    const message = responseBody?.message || responseBody?.error || response.statusText;
    throw new MedicalRecordApiError(message, response.status);
  }
  if (!Array.isArray(body)) throw new Error("INVALID_MEDICAL_RECORD_RESPONSE");
  return body as MedicalRecordApiItem[];
}
