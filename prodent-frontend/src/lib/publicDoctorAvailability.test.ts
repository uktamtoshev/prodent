import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PublicDoctorAvailabilityError,
  buildPublicDoctorAvailabilityUrl,
  getPublicDoctorAvailability,
} from "./publicDoctorAvailability";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public doctor availability", () => {
  it("builds a bounded URL from doctor, clinic, service and local date", () => {
    expect(
      buildPublicDoctorAvailabilityUrl({
        doctorId: "doctor/1",
        clinicId: "clinic 1",
        serviceId: "service&1",
        date: "2026-07-25",
      }),
    ).toBe(
      "/api/v1/public/doctors/doctor%2F1/availability" +
        "?clinicId=clinic+1&serviceId=service%261&date=2026-07-25",
    );
  });

  it("omits serviceId entirely when no service is chosen", () => {
    // The backend declares serviceId @RequestParam(required = false); sending
    // an empty serviceId= would lean on Spring coercing "" to null for a UUID.
    expect(
      buildPublicDoctorAvailabilityUrl({
        doctorId: "doctor-1",
        clinicId: "clinic-1",
        date: "2026-07-25",
      }),
    ).toBe(
      "/api/v1/public/doctors/doctor-1/availability?clinicId=clinic-1&date=2026-07-25",
    );
  });

  it("returns only backend-approved slots and passes AbortSignal", async () => {
    const payload = {
      doctorId: "doctor-1",
      clinicId: "clinic-1",
      serviceId: "service-1",
      date: "2026-07-25",
      timezone: "Asia/Tashkent",
      durationMinutes: 45,
      slots: [
        { startTime: "09:00", endTime: "09:45" },
        { startTime: "10:30", endTime: "11:15" },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(
      getPublicDoctorAvailability(
        {
          doctorId: "doctor-1",
          clinicId: "clinic-1",
          serviceId: "service-1",
          date: "2026-07-25",
        },
        { signal: controller.signal },
      ),
    ).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/public/doctors/doctor-1/availability" +
        "?clinicId=clinic-1&serviceId=service-1&date=2026-07-25",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );
  });

  it("keeps the backend status and message for retry UI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Availability unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      getPublicDoctorAvailability({
        doctorId: "doctor-1",
        clinicId: "clinic-1",
        serviceId: "service-1",
        date: "2026-07-25",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PublicDoctorAvailabilityError>>({
        name: "PublicDoctorAvailabilityError",
        message: "Availability unavailable",
        status: 503,
      }),
    );
  });
});
