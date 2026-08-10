import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveDoctorService,
  createDoctorService,
  listManagedDoctorServices,
  updateDoctorService,
  type DoctorServiceWriteInput,
} from "./doctor-services-api";

const input: DoctorServiceWriteInput = {
  name: "Консультация",
  description: "Описание",
  category: "Консультация",
  price: 25.5,
  currency: "USD",
  durationMinutes: 30,
  isActive: true,
};

const service = {
  id: "doctor-service-1",
  doctorId: "doctor-1",
  ...input,
  nameEn: null,
  nameUz: null,
  descriptionEn: null,
  descriptionUz: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("doctor owned services API", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "access-token");
    vi.restoreAllMocks();
  });

  it("lists active and inactive self-owned services", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([service]));

    await expect(listManagedDoctorServices("doctor-1")).resolves.toEqual([service]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/doctors/doctor-1/services?includeInactive=true",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("creates, updates and archives only through doctor scoped resources", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(service, 201))
      .mockResolvedValueOnce(jsonResponse({ ...service, name: "Повторная консультация" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await createDoctorService("doctor-1", input);
    await updateDoctorService("doctor-1", "doctor-service-1", {
      ...input,
      name: "Повторная консультация",
    });
    await archiveDoctorService("doctor-1", "doctor-service-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/doctors/doctor-1/services",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/doctors/doctor-1/services/doctor-service-1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/doctors/doctor-1/services/doctor-service-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("rejects a response with unsupported currency", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([
      { ...service, currency: "EUR" },
    ]));

    await expect(listManagedDoctorServices("doctor-1")).rejects.toMatchObject({
      status: 502,
    });
  });
});
