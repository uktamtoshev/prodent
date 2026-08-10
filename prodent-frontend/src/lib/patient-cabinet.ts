const ACCESS_TOKEN_KEY = "prodent_access_token";
const DRAFT_PREFIX = "prodent_patient_draft";

export type PatientDraftKind = "message" | "family" | "booking";

function draftKey(kind: PatientDraftKind, userId: string): string {
  return `${DRAFT_PREFIX}:${kind}:${userId}`;
}

export function appointmentStartsAt(date: string, time?: string | null): Date {
  const normalizedTime = time?.trim() || "00:00:00";
  return new Date(`${date}T${normalizedTime}+05:00`);
}

export function savePatientDraft<T>(
  kind: PatientDraftKind,
  userId: string | undefined,
  value: T,
): void {
  if (!userId) return;
  localStorage.setItem(draftKey(kind, userId), JSON.stringify(value));
}

export function loadPatientDraft<T>(
  kind: PatientDraftKind,
  userId: string | undefined,
  fallback: T,
): T {
  if (!userId) return fallback;
  try {
    const saved = localStorage.getItem(draftKey(kind, userId));
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function clearPatientDraft(
  kind: PatientDraftKind,
  userId: string | undefined,
): void {
  if (userId) localStorage.removeItem(draftKey(kind, userId));
}

export function privateFilePath(rawUrl: string): string {
  const parsed = new URL(rawUrl, window.location.origin);
  if (!parsed.pathname.startsWith("/api/v1/storage/")) {
    throw new Error("Unsupported private file URL");
  }
  return `${parsed.pathname}${parsed.hash}`;
}

export async function loadPrivatePatientFileObjectUrl(
  rawUrl: string,
): Promise<string> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) throw new Error("Authentication required");

  const response = await fetch(privateFilePath(rawUrl), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`File download failed (${response.status})`);

  return URL.createObjectURL(await response.blob());
}

export async function openPrivatePatientFile(rawUrl: string): Promise<void> {
  const objectUrl = await loadPrivatePatientFileObjectUrl(rawUrl);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
