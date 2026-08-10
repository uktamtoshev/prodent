import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CLINIC_SEARCH_URL_STATE } from "./clinicSearchUrlState";
import {
  buildPublicClinicSearchUrl,
  searchPublicClinics,
  type PublicClinicSearchPageDto,
} from "./publicClinicSearch";

const DTO: PublicClinicSearchPageDto = {
  content: [{
    id: "c1", name: "Clinic", city: "Tashkent", district: "Chilanzar",
    address: "Street 1", phone: null, email: null, website: null, description: null,
    isVerified: true, logoUrl: null, coverUrl: null, latitude: 41.3, longitude: 69.2,
    subscriptionPlan: "top", rating: 4.8, reviewCount: 20, workingHours: null,
    doctorCount: 12,
  }],
  number: 1, size: 24, totalElements: 30, totalPages: 2,
  first: false, last: true, empty: false,
};

afterEach(() => vi.unstubAllGlobals());

describe("public clinic search", () => {
  it("uses a bounded dedicated endpoint", () => {
    expect(buildPublicClinicSearchUrl({
      ...DEFAULT_CLINIC_SEARCH_URL_STATE,
      q: "Dental & Co", city: "tashkent", district: "chilanzar",
      sort: "rating", page: 1,
    })).toBe(
      "/api/v1/public/clinics/search?query=Dental+%26+Co&city=tashkent&district=chilanzar&sort=rating&page=1&size=24",
    );
  });

  it("adapts the page and forwards cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(DTO), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const page = await searchPublicClinics({ page: 1 }, { signal: controller.signal });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/public/clinics/search?page=1&size=24",
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(page.items[0]).toEqual(expect.objectContaining({
      id: "c1", is_verified: true, doctorCount: 12, review_count: 20,
    }));
    expect(page.totalElements).toBe(30);
  });
});
