export type ReviewDecision = "approved" | "rejected";
export type VerificationApplicationType =
  | "doctor"
  | "clinic"
  | "technician"
  | "supplier";

const ACCESS_TOKEN_KEY = "prodent_access_token";

export function normalizeReviewReason(reason: string): string {
  const normalized = reason.trim();
  if (!normalized) {
    throw new Error("review reason is required");
  }
  return normalized;
}

export function buildReviewPayload(
  decision: ReviewDecision,
  reason: string,
  reviewerId: string | null | undefined,
) {
  const reviewReason = normalizeReviewReason(reason);
  const common = {
    status: decision,
    review_reason: reviewReason,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerId ?? null,
  };

  return decision === "rejected"
    ? { ...common, rejection_reason: reviewReason }
    : common;
}

export async function submitVerificationDecision(
  type: VerificationApplicationType,
  applicationId: string,
  decision: ReviewDecision,
  reason: string,
): Promise<void> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) throw new Error("Authentication required");

  const response = await fetch(
    `/api/v1/admin/verifications/${type}/${encodeURIComponent(applicationId)}/decision`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision,
        reason: normalizeReviewReason(reason),
      }),
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || payload?.error || `Decision failed (${response.status})`);
  }
}
