import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveClinicService,
  archiveClinicServices,
  bulkCreateClinicServices,
  createClinicService,
  listManagedClinicServices,
  listPublicClinicServices,
  setClinicServicesActive,
  toLegacyClinicService,
  updateClinicService,
  type ClinicServiceWriteInput,
} from "./clinic-service-management-api";

const serviceInput: ClinicServiceWriteInput = {
  nameRu: "Лечение кариеса",
  category: "Терапия",
  price: 0,
  currency: "UZS",
  duration: 30,
  isActive: false,
};

const serviceResponse = {
  id: "service-1",
  nameRu: "Лечение кариеса",
  nameUz: "Kariyesni davolash",
  nameUzCyrl: null,
  nameKz: null,
  nameKg: null,
  nameTj: null,
  descriptionRu: "Описание",
  descriptionUz: null,
  descriptionUzCyrl: null,
  descriptionKz: null,
  descriptionKg: null,
  descriptionTj: null,
  category: "Терапия",
  price: 0,
  currency: "UZS",
  duration: 30,
  isActive: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("clinic service management API", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "access-token");
    vi.restoreAllMocks();
  });

  it("loads active and inactive services from the dedicated clinic endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([serviceResponse]),
    );

    await expect(listManagedClinicServices("clinic 1")).resolves.toEqual([serviceResponse]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/clinics/clinic%201/services?includeInactive=true",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("loads the public catalog through the cache-backed clinic endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([serviceResponse]),
    );

    await expect(listPublicClinicServices("clinic 1")).resolves.toEqual([serviceResponse]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/clinics/clinic%201/services",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uses canonical camelCase payloads for create and update", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(serviceResponse, 201))
      .mockResolvedValueOnce(jsonResponse({ ...serviceResponse, isActive: true }));

    await createClinicService("clinic-1", serviceInput);
    await updateClinicService("clinic-1", "service-1", {
      ...serviceInput,
      isActive: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/clinics/clinic-1/services",
      expect.objectContaining({ method: "POST", body: JSON.stringify(serviceInput) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/clinics/clinic-1/services/service-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ ...serviceInput, isActive: true }),
      }),
    );
  });

  it("uses transactional bulk commands for create, status and archive", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([serviceResponse], 201))
      .mockResolvedValueOnce(jsonResponse([{ ...serviceResponse, isActive: true }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await bulkCreateClinicServices("clinic-1", [serviceInput]);
    await setClinicServicesActive("clinic-1", ["service-1", "service-2"], true);
    await archiveClinicServices("clinic-1", ["service-1", "service-2"]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/clinics/clinic-1/services/commands/bulk-create",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ services: [serviceInput] }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/clinics/clinic-1/services/commands/bulk-status",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ serviceIds: ["service-1", "service-2"], isActive: true }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/clinics/clinic-1/services/commands/bulk-delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ serviceIds: ["service-1", "service-2"] }),
      }),
    );
  });

  it("archives one service through the scoped resource endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await archiveClinicService("clinic-1", "service-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/clinics/clinic-1/services/service-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("refreshes once after 401 and retries the original request", async () => {
    localStorage.setItem("prodent_refresh_token", "refresh-token");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: "fresh-token" }))
      .mockResolvedValueOnce(jsonResponse([serviceResponse]));

    await listManagedClinicServices("clinic-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh_token: "refresh-token" }),
      }),
    );
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    }));
  });

  it("preserves backend error status and maps canonical rows for legacy UI props", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Foreign clinic service" }, 403),
    );

    await expect(archiveClinicService("clinic-1", "foreign-service")).rejects.toMatchObject({
      message: "Foreign clinic service",
      status: 403,
    });
    expect(toLegacyClinicService(serviceResponse)).toEqual(expect.objectContaining({
      id: "service-1",
      name: "Лечение кариеса",
      description: "Описание",
      duration_minutes: 30,
      is_active: false,
      price: 0,
    }));
  });

  it("rejects malformed management responses instead of hiding contract failures", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ data: [serviceResponse] }))
      .mockResolvedValueOnce(jsonResponse([{ ...serviceResponse, price: "not-a-number" }]))
      .mockResolvedValueOnce(jsonResponse([{ ...serviceResponse, currency: "EUR" }]))
      .mockResolvedValueOnce(jsonResponse([{ ...serviceResponse, duration: 0 }]))
      .mockResolvedValueOnce(jsonResponse([{ ...serviceResponse, isActive: "true" }]))
      .mockResolvedValueOnce(jsonResponse([{ ...serviceResponse, id: "" }]))
      .mockResolvedValueOnce(jsonResponse([{ ...serviceResponse, nameRu: "" }]));

    for (let index = 0; index < 7; index += 1) {
      await expect(listManagedClinicServices("clinic-1")).rejects.toMatchObject({
        status: 502,
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
});
