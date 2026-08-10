import { describe, expect, it } from "vitest";

import { filterSearchDoctors, getSearchDoctors, type SearchDoctor } from "./searchDoctors";

const baseFilters = {
  searchQuery: "",
  spec: "all",
  city: "all",
  district: "all",
  priceRange: [0, 10_000_000] as [number, number],
  minRating: null,
  hasVideo: false,
};

function doctor(overrides: Partial<SearchDoctor>): SearchDoctor {
  return {
    id: "doctor",
    specialty: "терапевт",
    experience_years: 5,
    price_from: 100_000,
    rating: 4.7,
    video_url: null,
    subscription_plan: null,
    profiles: { full_name: "Доктор" },
    clinics: { city: "Ташкент", district: "Юнусабадский" },
    ...overrides,
  };
}

describe("search doctors filtering", () => {
  it("does not show doctors without a matching city when a city filter is active", () => {
    const result = filterSearchDoctors(
      [
        doctor({ id: "tashkent", clinics: { city: "Ташкент", district: "Юнусабадский" } }),
        doctor({ id: "unknown-city", clinics: { city: null, district: "Юнусабадский" } }),
      ],
      { ...baseFilters, city: "tashkent" },
    );

    expect(result.map((item) => item.id)).toEqual(["tashkent"]);
  });

  it("does not show doctors without a matching district when a district filter is active", () => {
    const result = filterSearchDoctors(
      [
        doctor({ id: "yunusabad", clinics: { city: "Ташкент", district: "Юнусабадский" } }),
        doctor({ id: "missing-district", clinics: { city: "Ташкент", district: null } }),
      ],
      { ...baseFilters, district: "Юнусабадский" },
    );

    expect(result.map((item) => item.id)).toEqual(["yunusabad"]);
  });

  it("matches by name, specialty, price, rating, and video filters together", () => {
    const result = filterSearchDoctors(
      [
        doctor({
          id: "match",
          specialty: "ортодонт",
          price_from: 250_000,
          rating: 4.9,
          video_url: "https://example.test/video.mp4",
          profiles: { full_name: "Азиза Каримова" },
        }),
        doctor({ id: "too-low-rating", specialty: "ортодонт", rating: 4.1 }),
        doctor({ id: "no-video", specialty: "ортодонт", rating: 4.9 }),
      ],
      {
        ...baseFilters,
        searchQuery: "азиза",
        spec: "orthodontist",
        priceRange: [200_000, 300_000],
        minRating: 4.5,
        hasVideo: true,
      },
    );

    expect(result.map((item) => item.id)).toEqual(["match"]);
  });
});

describe("search doctors sorting", () => {
  it("keeps promoted doctors first, then sorts by selected value", () => {
    const result = getSearchDoctors(
      [
        doctor({ id: "regular-expensive", price_from: 500_000, subscription_plan: null }),
        doctor({ id: "gold-expensive", price_from: 600_000, subscription_plan: "gold" }),
        doctor({ id: "regular-cheap", price_from: 100_000, subscription_plan: null }),
      ],
      baseFilters,
      "price-asc",
    );

    expect(result.map((item) => item.id)).toEqual([
      "gold-expensive",
      "regular-cheap",
      "regular-expensive",
    ]);
  });
});
