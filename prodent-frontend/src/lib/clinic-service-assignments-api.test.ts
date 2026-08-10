import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listClinicServiceDoctorAssignments,
  syncClinicServiceDoctorAssignments,
} from "./clinic-service-assignments-api";

const assignment = {
  id: "assignment-1",
  clinicId: "clinic-1",
  serviceId: "service-1",
  doctorId: "doctor-1",
  customPrice: 125000,
  isActive: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("clinic service doctor assignments API", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "access-token");
    vi.restoreAllMocks();
  });

  it("lists assignments through the clinic and service scoped endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([assignment]),
    );

    await expect(listClinicServiceDoctorAssignments("clinic-1", "service-1"))
      .resolves.toEqual([assignment]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/clinics/clinic-1/service-doctor-assignments?serviceId=service-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends one atomic desired active assignment set", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([assignment]),
    );

    await syncClinicServiceDoctorAssignments("clinic-1", "service-1", [
      { doctorId: "doctor-1", customPrice: 125000 },
      { doctorId: "doctor-2", customPrice: null },
    ]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/clinics/clinic-1/services/service-1/doctor-assignments",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ assignments: [
          { doctorId: "doctor-1", customPrice: 125000 },
          { doctorId: "doctor-2", customPrice: null },
        ] }),
      }),
    );
  });
});
