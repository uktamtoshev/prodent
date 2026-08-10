import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: authMocks,
  },
}));

import {
  getEligibleTreatmentPlanPatients,
  TreatmentPlanApiError,
  type TreatmentPlanDto,
  type UpdateTreatmentPlanRequest,
  updateTreatmentPlan,
} from "./treatment-plans-api";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

const request: UpdateTreatmentPlanRequest = {
  title: "Updated plan",
  description: "Complete ordered snapshot",
  discountType: "PERCENT",
  discountValue: 10,
  discountComment: "Loyal patient",
  items: [
    {
      id: "item-1",
      serviceId: "service-1",
      toothNumber: 11,
      description: "Implant",
      quantity: 2,
      unitPrice: 100,
      stageName: "Stage 1",
      notes: "First visit",
    },
    {
      serviceId: null,
      toothNumber: null,
      description: "Follow-up",
      quantity: 1,
      unitPrice: 50,
      stageName: null,
      notes: null,
    },
  ],
};

const validPlan: TreatmentPlanDto = {
  id: "plan/id with space",
  patientId: "patient-1",
  doctorName: "Dr Test",
  clinicName: "Prodent Test Clinic",
  title: request.title,
  description: request.description ?? null,
  status: "PLANNED",
  totalCost: 225,
  discountType: request.discountType,
  discountValue: request.discountValue,
  discountAmount: 25,
  discountComment: request.discountComment ?? null,
  patientConsentConfirmedAt: null,
  currency: "UZS",
  items: [
    {
      id: "item-1",
      serviceId: "service-1",
      toothNumber: 11,
      description: "Implant",
      quantity: 2,
      unitPrice: 100,
      totalPrice: 200,
      status: "PLANNED",
      stageName: "Stage 1",
      notes: "First visit",
    },
    {
      id: "item-2",
      serviceId: null,
      toothNumber: null,
      description: "Follow-up",
      quantity: 1,
      unitPrice: 50,
      totalPrice: 50,
      status: "PLANNED",
      stageName: null,
      notes: null,
    },
  ],
  createdAt: "2026-07-21T00:00:00Z",
};

describe("updateTreatmentPlan", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    authMocks.getSession.mockReset();
    authMocks.getUser.mockReset();
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null,
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends one atomic PUT with auth and only editable fields", async () => {
    fetchMock.mockResolvedValue(response(validPlan));

    await expect(
      updateTreatmentPlan("plan/id with space", request),
    ).resolves.toEqual(validPlan);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/treatment-plans/plan%2Fid%20with%20space",
      {
        method: "PUT",
        body: JSON.stringify(request),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "Bearer access-token",
        },
        credentials: "omit",
        cache: "no-store",
      },
    );

    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(payload).toEqual(request);
    expect(payload).not.toHaveProperty("totalCost");
    expect(payload).not.toHaveProperty("discountAmount");
    for (const item of payload.items as Record<string, unknown>[]) {
      expect(item).not.toHaveProperty("totalPrice");
      expect(item).not.toHaveProperty("status");
    }
  });

  it("converts a 4xx response into TreatmentPlanApiError", async () => {
    fetchMock.mockResolvedValue(response({ message: "Invalid unit price" }, 422));

    await expect(updateTreatmentPlan("plan-1", request)).rejects.toEqual(
      new TreatmentPlanApiError("Invalid unit price", 422),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loads a validated eligible-patient page with encoded params and abort signal", async () => {
    fetchMock.mockResolvedValue(response({
      content: [{
        id: "patient-1",
        fullName: "Ali Valiyev",
        phone: "+998901112233",
        email: "must-not-leak@test.local",
      }],
      page: 2,
      size: 50,
      hasNext: true,
    }));
    const signal = new AbortController().signal;

    await expect(getEligibleTreatmentPlanPatients({
      clinicId: "clinic/id",
      search: " Ali Valiyev ",
      page: 2,
      size: 50,
      signal,
    })).resolves.toEqual({
      content: [{
        id: "patient-1",
        fullName: "Ali Valiyev",
        phone: "+998901112233",
      }],
      page: 2,
      size: 50,
      hasNext: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/treatment-plans/eligible-patients?clinicId=clinic%2Fid&page=2&size=50&search=Ali+Valiyev",
      {
        signal,
        headers: {
          Accept: "application/json",
          Authorization: "Bearer access-token",
        },
        credentials: "omit",
        cache: "no-store",
      },
    );
  });
});
