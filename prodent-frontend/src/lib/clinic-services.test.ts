import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadActiveClinicServiceOptions } from "./clinic-services";

const serviceResponse = {
  id: "service-1",
  nameRu: "Лечение кариеса",
  nameUz: "Kariyesni davolash",
  nameUzCyrl: null,
  nameKz: null,
  nameKg: null,
  nameTj: null,
  descriptionRu: null,
  descriptionUz: null,
  descriptionUzCyrl: null,
  descriptionKz: null,
  descriptionKg: null,
  descriptionTj: null,
  category: null,
  price: 125000.5,
  currency: "UZS",
  duration: 30,
  isActive: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("loadActiveClinicServiceOptions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses the canonical public catalog and normalizes localized rows", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([serviceResponse]),
    );

    await expect(loadActiveClinicServiceOptions("clinic-1", "uz")).resolves.toEqual([{
      id: "service-1",
      name: "Kariyesni davolash",
      price: 125000.5,
      category: "",
    }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/clinics/clinic-1/services",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("falls back to Russian when the selected translation is blank", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([{
      ...serviceResponse,
      id: "service-2",
      nameRu: "Осмотр",
      nameUz: "  ",
      price: 50000,
      category: "Диагностика",
    }]));

    const [service] = await loadActiveClinicServiceOptions("clinic-1", "uz");

    expect(service.name).toBe("Осмотр");
  });

  it("throws backend errors instead of turning them into an empty catalog", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "services query failed" }, 500),
    );

    await expect(loadActiveClinicServiceOptions("clinic-1", "ru")).rejects.toMatchObject({
      message: "services query failed",
      status: 500,
    });
  });
});
