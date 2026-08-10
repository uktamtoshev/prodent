import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { apiFetch } from "@/integrations/supabase/client";

export type PatientFile = Tables<"patient_files">;
type PatientFileInsert = TablesInsert<"patient_files">;
type PatientFileUpdate = TablesUpdate<"patient_files">;

interface ApiError { message: string; status?: number }

async function request<T>(url: string, init?: RequestInit): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const response = await apiFetch(url, init);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body && typeof body === "object" && body !== null && "error" in body
        ? String((body as { error?: unknown }).error)
        : response.statusText || "Patient files request failed";
      return { data: null, error: { message, status: response.status } };
    }
    return { data: body as T, error: null };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : "Network error" } };
  }
}

export function listPatientFiles(patientId: string) {
  return request<PatientFile[]>(`/api/v1/patient-files?patientId=${encodeURIComponent(patientId)}`);
}

export function createPatientFile(input: PatientFileInsert) {
  return request<PatientFile>("/api/v1/patient-files", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePatientFile(id: string, input: PatientFileUpdate) {
  return request<PatientFile>(`/api/v1/patient-files/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
