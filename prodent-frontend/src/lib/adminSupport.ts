const ACCESS_TOKEN_KEY = "prodent_access_token";

export interface SupportPatient {
  id: string;
  displayName: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  active: boolean;
  verified: boolean;
  createdAt: string;
}

export interface SupportPatientPage {
  content: SupportPatient[];
  totalElements: number;
  totalPages: number;
}

export async function searchSupportPatients(input: {
  query: string;
  reason: string;
  page: number;
  size: number;
}): Promise<SupportPatientPage> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) throw new Error("Authentication required");
  const reason = input.reason.trim();
  if (!reason) throw new Error("Support reason is required");

  const params = new URLSearchParams({
    query: input.query.trim(),
    reason,
    page: String(input.page),
    size: String(input.size),
  });
  const response = await fetch(`/api/v1/admin/support/patients?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || payload?.error || `Search failed (${response.status})`);
  }
  return response.json() as Promise<SupportPatientPage>;
}
