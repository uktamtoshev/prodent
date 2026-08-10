import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildTreatmentPlanPublicUrl,
  createTreatmentPlanShareLink,
  resolvePublicTreatmentPlan,
  revokeTreatmentPlanShareLink,
  TreatmentPlanLinkError,
} from "./treatment-plan-links";

const validPublicPlan = {
  title: "Implant treatment",
  status: "IN_PROGRESS",
  totalCost: 2_500_000,
  currency: "uzs",
  createdAt: "2026-07-20T10:00:00Z",
  approvedAt: null,
  doctorName: "Dr Test",
  clinicName: "Prodent Test Clinic",
  expiresAt: "2026-07-27T10:00:00Z",
  items: [
    {
      position: 1,
      toothNumber: 11,
      description: "Implant",
      quantity: 1,
      unitPrice: 2_500_000,
      totalPrice: 2_500_000,
      status: "PLANNED",
    },
  ],
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(
      typeof body === "string" ? body : JSON.stringify(body),
    ),
  } as unknown as Response;
}

describe("treatment plan links", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("parses a valid public plan and sends the token only in the POST body", async () => {
    const signal = new AbortController().signal;
    fetchMock.mockResolvedValue(response(validPublicPlan));

    await expect(resolvePublicTreatmentPlan("public-token", signal)).resolves.toEqual({
      ...validPublicPlan,
      currency: "UZS",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/public/treatment-plans/resolve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "public-token" }),
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
      }),
    );
  });

  it("rejects an invalid public payload", async () => {
    fetchMock.mockResolvedValue(
      response({ ...validPublicPlan, status: "approved" }),
    );

    await expect(resolvePublicTreatmentPlan("public-token")).rejects.toMatchObject({
      name: "TreatmentPlanLinkError",
      message: "Invalid status",
      status: 502,
    });
  });

  it("rejects invalid JSON without exposing its content", async () => {
    fetchMock.mockResolvedValue(response("not-json"));

    await expect(resolvePublicTreatmentPlan("public-token")).rejects.toEqual(
      new TreatmentPlanLinkError("Invalid server response", 200),
    );
  });

  it("preserves the server status and safe error message", async () => {
    fetchMock.mockResolvedValue(response({ message: "Link expired" }, 404));

    await expect(resolvePublicTreatmentPlan("expired-token")).rejects.toMatchObject({
      message: "Link expired",
      status: 404,
    });
  });

  it("does not call the private API without a local access token", async () => {
    await expect(createTreatmentPlanShareLink("plan-id")).rejects.toMatchObject({
      message: "Authentication required",
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a private share link with auth and an encoded plan id", async () => {
    localStorage.setItem("prodent_access_token", "access-token");
    fetchMock.mockResolvedValue(
      response({ token: "new-token", expiresAt: "2026-07-27T10:00:00Z" }, 201),
    );

    await expect(createTreatmentPlanShareLink("plan/id")).resolves.toEqual({
      token: "new-token",
      expiresAt: "2026-07-27T10:00:00Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/treatment-plans/plan%2Fid/share-link",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("returns private API errors when revoking a link", async () => {
    localStorage.setItem("prodent_access_token", "access-token");
    fetchMock.mockResolvedValue(response({ message: "Too many requests" }, 429));

    await expect(revokeTreatmentPlanShareLink("plan-id")).rejects.toMatchObject({
      message: "Too many requests",
      status: 429,
    });
  });

  it("builds a same-origin URL with the token in the fragment", () => {
    const url = new URL(buildTreatmentPlanPublicUrl("a+b/=?&"));

    expect(url.origin).toBe("https://app.prodent.test");
    expect(url.pathname).toBe("/treatment-plan");
    expect(url.search).toBe("");
    expect(url.hash).toBe("#t=a%2Bb%2F%3D%3F%26");
  });
});
