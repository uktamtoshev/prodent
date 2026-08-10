import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelDoctorClinicRequest,
  createDoctorClinicRequest,
  decideDoctorClinicRequest,
  hasPendingDoctorClinicRequest,
  normalizeDoctorClinicRequestStatus,
} from "./doctor-clinic-requests-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("doctor clinic request decisions", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "access-token");
    vi.restoreAllMocks();
  });

  it("creates a request through the protected endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ id: "request-1" }, 201),
    );

    await createDoctorClinicRequest({
      doctorId: "doctor-1",
      clinicId: "clinic-1",
      requestType: "clinic_to_doctor",
      message: "Welcome",
      cooperationType: "staff_doctor",
      salaryMode: "percent",
      salaryPercent: 35,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/doctor-clinic-requests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          doctorId: "doctor-1",
          clinicId: "clinic-1",
          requestType: "clinic_to_doctor",
          message: "Welcome",
          cooperationType: "staff_doctor",
          salaryMode: "percent",
          salaryPercent: 35,
        }),
      }),
    );
  });

  it("cancels a pending doctor request through the protected endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await cancelDoctorClinicRequest("request 1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/doctor-clinic-requests/request%201",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("sends the exact atomic decision contract", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ status: "approved" }),
    );

    await decideDoctorClinicRequest("request 1", "accept");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/doctor-clinic-requests/request%201/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decision: "accept" }),
      }),
    );
  });

  it("preserves backend authorization failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Request actor mismatch" }, 403),
    );

    await expect(decideDoctorClinicRequest("request-1", "reject")).rejects.toMatchObject({
      message: "Request actor mismatch",
      status: 403,
    });
  });

  it("trims and sends an optional rejection reason", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ status: "rejected" }),
    );

    await decideDoctorClinicRequest("request-1", "reject", "  Not a match  ");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/doctor-clinic-requests/request-1/decision",
      expect.objectContaining({
        body: JSON.stringify({ decision: "reject", rejectionReason: "Not a match" }),
      }),
    );
  });

  it("blocks only a pending request for the same clinic", () => {
    const history = [
      { clinic_id: "clinic-1", status: "approved" },
      { clinic_id: "clinic-2", status: "rejected" },
      { clinic_id: "clinic-3", status: "PENDING" },
    ];

    expect(hasPendingDoctorClinicRequest(history, "clinic-1")).toBe(false);
    expect(hasPendingDoctorClinicRequest(history, "clinic-2")).toBe(false);
    expect(hasPendingDoctorClinicRequest(history, "clinic-3")).toBe(true);
  });

  it.each([
    ["pending", "pending"],
    ["PENDING", "pending"],
    ["Pending", "pending"],
    ["approved", "approved"],
    ["APPROVED", "approved"],
    ["rejected", "rejected"],
    ["REJECTED", "rejected"],
  ] as const)("normalizes legacy status %s to %s", (stored, expected) => {
    expect(normalizeDoctorClinicRequestStatus(stored)).toBe(expected);
  });

  it("does not treat unknown request states as a known status", () => {
    expect(normalizeDoctorClinicRequestStatus("cancelled")).toBeNull();
    expect(normalizeDoctorClinicRequestStatus(null)).toBeNull();
  });
});
