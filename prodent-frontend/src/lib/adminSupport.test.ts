import { afterEach, describe, expect, it, vi } from "vitest";

import { searchSupportPatients } from "./adminSupport";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("admin patient support search", () => {
  it("uses the audited safe endpoint with a required reason", async () => {
    localStorage.setItem("prodent_access_token", "admin-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ content: [], totalElements: 0, totalPages: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await searchSupportPatients({
      query: "Ali",
      reason: "Проверка аккаунта по обращению",
      page: 0,
      size: 25,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/support/patients?query=Ali&reason=%D0%9F%D1%80%D0%BE%D0%B2%D0%B5%D1%80%D0%BA%D0%B0+%D0%B0%D0%BA%D0%BA%D0%B0%D1%83%D0%BD%D1%82%D0%B0+%D0%BF%D0%BE+%D0%BE%D0%B1%D1%80%D0%B0%D1%89%D0%B5%D0%BD%D0%B8%D1%8E&page=0&size=25",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
  });
});
