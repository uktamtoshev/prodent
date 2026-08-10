import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SEARCH_URL_STATE } from "./searchUrlState";
import {
  PUBLIC_DOCTOR_SEARCH_PAGE_SIZE,
  PublicDoctorSearchError,
  buildPublicDoctorSearchUrl,
  searchPublicDoctors,
  type PublicDoctorSearchPageDto,
} from "./publicDoctorSearch";

const PAGE_DTO: PublicDoctorSearchPageDto = {
  content: [
    {
      id: "doctor-1",
      fullName: "Азиза Каримова",
      avatarUrl: "/avatars/aziza.webp",
      gender: "female",
      specialty: "Ортодонт",
      experienceYears: 12,
      priceFrom: 250_000,
      rating: 4.9,
      reviewCount: 81,
      isVerified: true,
      images: ["/work/1.webp"],
      videoUrl: "/video/doctor-1.mp4",
      latitude: 41.31,
      longitude: 69.28,
      subscriptionPlan: "premium",
      clinic: {
        id: "clinic-1",
        name: "Prodent Clinic",
        city: "Ташкент",
        district: "Юнусабадский",
        latitude: 41.32,
        longitude: 69.29,
      },
    },
  ],
  number: 2,
  size: 24,
  totalElements: 73,
  totalPages: 4,
  first: false,
  last: false,
  empty: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public doctor search URL", () => {
  it("uses the dedicated endpoint, fixed page size, filters, and URL encoding", () => {
    const url = buildPublicDoctorSearchUrl({
      ...DEFAULT_SEARCH_URL_STATE,
      q: "Азиза & Co",
      specialty: "orthodontist",
      city: "tashkent",
      district: "Юнусабадский",
      minPrice: 100_000,
      maxPrice: 700_000,
      rating: 4.5,
      video: true,
      sort: "price-asc",
      page: 2,
    });

    expect(url).toBe(
      "/api/v1/public/doctors/search?query=%D0%90%D0%B7%D0%B8%D0%B7%D0%B0+%26+Co" +
        "&specialty=orthodontist&city=tashkent" +
        "&district=%D0%AE%D0%BD%D1%83%D1%81%D0%B0%D0%B1%D0%B0%D0%B4%D1%81%D0%BA%D0%B8%D0%B9" +
        "&minPrice=100000&maxPrice=700000&rating=4.5&video=true" +
        "&sort=price-asc&page=2&size=24",
    );
  });

  it("never exposes a caller-controlled page size", () => {
    const url = new URL(
      buildPublicDoctorSearchUrl(DEFAULT_SEARCH_URL_STATE),
      "https://prodent.test",
    );

    expect(url.searchParams.get("size")).toBe(String(PUBLIC_DOCTOR_SEARCH_PAGE_SIZE));
    expect(url.searchParams.get("page")).toBe("0");
  });
});

describe("public doctor search request", () => {
  it("passes AbortSignal and adapts the documented page DTO", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(PAGE_DTO), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const page = await searchPublicDoctors(DEFAULT_SEARCH_URL_STATE, {
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/public/doctors/search?page=0&size=24",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );
    expect(page).toEqual({
      items: [
        {
          id: "doctor-1",
          specialty: "Ортодонт",
          experience_years: 12,
          price_from: 250_000,
          rating: 4.9,
          review_count: 81,
          is_verified: true,
          images: ["/work/1.webp"],
          video_url: "/video/doctor-1.mp4",
          latitude: 41.31,
          longitude: 69.28,
          subscription_plan: "premium",
          profiles: {
            full_name: "Азиза Каримова",
            avatar_url: "/avatars/aziza.webp",
            gender: "female",
          },
          clinics: {
            id: "clinic-1",
            name: "Prodent Clinic",
            city: "Ташкент",
            district: "Юнусабадский",
            latitude: 41.32,
            longitude: 69.29,
          },
        },
      ],
      page: 2,
      size: 24,
      totalElements: 73,
      totalPages: 4,
      first: false,
      last: false,
      empty: false,
    });
  });

  it("throws a typed error with the backend message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Search unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(searchPublicDoctors(DEFAULT_SEARCH_URL_STATE)).rejects.toEqual(
      expect.objectContaining<Partial<PublicDoctorSearchError>>({
        name: "PublicDoctorSearchError",
        message: "Search unavailable",
        status: 503,
      }),
    );
  });
});
