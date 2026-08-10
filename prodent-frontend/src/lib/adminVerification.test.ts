import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildReviewPayload,
  normalizeReviewReason,
  submitVerificationDecision,
} from "./adminVerification";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("admin verification decisions", () => {
  it("rejects an empty decision reason", () => {
    expect(() => normalizeReviewReason("   ")).toThrow("review reason is required");
  });

  it("stores one normalized reason for approval", () => {
    expect(buildReviewPayload("approved", "  Документы проверены  ", "reviewer-1")).toEqual({
      status: "approved",
      review_reason: "Документы проверены",
      reviewed_at: expect.any(String),
      reviewed_by: "reviewer-1",
    });
  });

  it("uses the same reason for rejection and the legacy rejection field", () => {
    expect(buildReviewPayload("rejected", "Лицензия просрочена", "reviewer-2")).toEqual({
      status: "rejected",
      review_reason: "Лицензия просрочена",
      rejection_reason: "Лицензия просрочена",
      reviewed_at: expect.any(String),
      reviewed_by: "reviewer-2",
    });
  });

  it("submits the decision through the atomic admin endpoint", async () => {
    localStorage.setItem("prodent_access_token", "admin-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await submitVerificationDecision("doctor", "application-1", "approved", " Checked ");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/verifications/doctor/application-1/decision",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ decision: "approved", reason: "Checked" }),
      }),
    );
  });
});
