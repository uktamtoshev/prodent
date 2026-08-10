import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CrmApiError,
  bulkAppointments,
  createClinicPayment,
  getClinicSchedule,
  getPersistentClientRequestId,
  listClinicStaffInvitations,
  listReportOperations,
  mergeDuplicatePatients,
  queueCommand,
  refundClinicPayment,
  resendClinicStaffInvitation,
  cancelClinicStaffInvitation,
} from "./crm-operations-api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Sprint 7 CRM operations API", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "test-token");
    vi.restoreAllMocks();
  });

  it("loads a bounded clinic schedule with encoded dates", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ appointments: [] }));

    await getClinicSchedule("clinic-1", "2026-07-25", "2026-07-31");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/crm/clinics/clinic-1/schedule?from=2026-07-25&to=2026-07-31",
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"),
    ).toBe("Bearer test-token");
  });

  it("sends atomic bulk operations with the stable request id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ applied: 2 }));
    const operations = [
      { appointmentId: "a-1", action: "STATUS", status: "ARRIVED", expectedVersion: 1 },
      { appointmentId: "a-2", action: "STATUS", status: "ARRIVED", expectedVersion: 2 },
    ];

    await bulkAppointments("clinic-1", "request-1", operations);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/crm/clinics/clinic-1/appointments/bulk",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ clientRequestId: "request-1", operations }),
      }),
    );
  });

  it("keeps request ids isolated by user, clinic and action until success", () => {
    const first = getPersistentClientRequestId("user-1", "clinic-1", "payment:draft-1");
    const retry = getPersistentClientRequestId("user-1", "clinic-1", "payment:draft-1");
    const otherClinic = getPersistentClientRequestId("user-1", "clinic-2", "payment:draft-1");

    expect(retry).toBe(first);
    expect(otherClinic).not.toBe(first);
  });

  it("uses dedicated payment and refund commands", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ id: "payment-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "refund-1" }));

    await createClinicPayment("clinic-1", {
      clientRequestId: "payment-request",
      invoiceId: "invoice-1",
      amount: 50_000,
      method: "CASH",
      notes: "",
    });
    await refundClinicPayment("clinic-1", "payment-1", {
      clientRequestId: "refund-request",
      amount: 10_000,
      reason: "Correction",
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/crm/clinics/clinic-1/payments",
      "/api/v1/crm/clinics/clinic-1/payments/payment-1/refunds",
    ]);
  });

  it("uses dedicated merge and queue commands", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await mergeDuplicatePatients("clinic-1", {
      clientRequestId: "merge-1",
      survivorGuestId: "guest-1",
      duplicateGuestIds: ["guest-2"],
    });
    await queueCommand("clinic-1", "reorder", {
      clientRequestId: "queue-1",
      queueEntryId: "queue-entry-1",
      queueNumber: 2,
      expectedVersion: 1,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/crm/clinics/clinic-1/patients/merge",
      "/api/v1/crm/clinics/clinic-1/queue/commands/reorder",
    ]);
  });

  it("encodes report cursor without leaking it into path", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ rows: [], nextCursor: null }));

    await listReportOperations("clinic-1", {
      from: "2026-07-01",
      to: "2026-07-31",
      cursor: "2026-07-20T12:00:00+05:00/id 1",
      size: 50,
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("cursor=2026-07-20T12%3A00%3A00%2B05%3A00%2Fid+1");
    expect(url).toContain("size=50");
  });

  it("surfaces a 409 conflict as a typed error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Version conflict", code: "STALE_VERSION" }, 409),
    );

    await expect(
      bulkAppointments("clinic-1", "request-1", [{ appointmentId: "a-1" }]),
    ).rejects.toMatchObject<Partial<CrmApiError>>({
      status: 409,
      code: "STALE_VERSION",
    });
  });

  it("lists, resends and cancels staff invitations through clinic-scoped endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse([]));
    await listClinicStaffInvitations("clinic-1", { status: "PENDING", size: 50 });
    await resendClinicStaffInvitation("clinic-1", "invite-1", {
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      expiresInHours: 72,
    });
    await cancelClinicStaffInvitation("clinic-1", "invite-1", {
      clientRequestId: "22222222-2222-4222-8222-222222222222",
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/crm/clinics/clinic-1/staff-invitations?status=PENDING&size=50",
      "/api/v1/crm/clinics/clinic-1/staff-invitations/invite-1/resend",
      "/api/v1/crm/clinics/clinic-1/staff-invitations/invite-1/cancel",
    ]);
  });
});
