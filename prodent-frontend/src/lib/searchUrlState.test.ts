import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEARCH_URL_STATE,
  parseSearchUrlState,
  patchSearchUrlState,
  serializeSearchUrlState,
} from "./searchUrlState";

describe("search URL state", () => {
  it("returns stable defaults for an empty URL", () => {
    expect(parseSearchUrlState("")).toEqual(DEFAULT_SEARCH_URL_STATE);
  });

  it("parses every supported value and preserves unicode", () => {
    const state = parseSearchUrlState(
      "?q=Азиза+Каримова&specialty=orthodontist&city=tashkent" +
        "&district=Юнусабадский&minPrice=150000&maxPrice=900000" +
        "&rating=4.5&video=1&sort=price-asc&view=grid&page=3",
    );

    expect(state).toEqual({
      q: "Азиза Каримова",
      specialty: "orthodontist",
      city: "tashkent",
      district: "Юнусабадский",
      minPrice: 150_000,
      maxPrice: 900_000,
      rating: 4.5,
      video: true,
      sort: "price-asc",
      view: "grid",
      page: 3,
    });
  });

  it("clamps numeric values and falls back from unknown enums", () => {
    expect(
      parseSearchUrlState(
        "?minPrice=-5&maxPrice=99999999&rating=9&page=-4&sort=random&view=table",
      ),
    ).toEqual({
      ...DEFAULT_SEARCH_URL_STATE,
      minPrice: 0,
      maxPrice: 10_000_000,
      rating: 5,
    });
  });

  it("keeps max price at least as large as min price", () => {
    const state = parseSearchUrlState("?minPrice=800000&maxPrice=200000");

    expect(state.minPrice).toBe(800_000);
    expect(state.maxPrice).toBe(800_000);
  });

  it("serializes only non-default values in canonical order", () => {
    const params = serializeSearchUrlState({
      ...DEFAULT_SEARCH_URL_STATE,
      q: "А Б",
      specialty: "pediatric",
      city: "samarkand",
      district: "Центр",
      minPrice: 50_000,
      maxPrice: 700_000,
      rating: 4,
      video: true,
      sort: "experience",
      view: "map",
      page: 2,
    });

    expect(params.toString()).toBe(
      "q=%D0%90+%D0%91&specialty=pediatric&city=samarkand" +
        "&district=%D0%A6%D0%B5%D0%BD%D1%82%D1%80&minPrice=50000" +
        "&maxPrice=700000&rating=4&video=1&sort=experience&view=map&page=2",
    );
    expect(serializeSearchUrlState(DEFAULT_SEARCH_URL_STATE).toString()).toBe("");
  });

  it("normalizes values before serializing", () => {
    const params = serializeSearchUrlState({
      ...DEFAULT_SEARCH_URL_STATE,
      q: "  doctor  ",
      minPrice: -10,
      maxPrice: 20_000_000,
      rating: 7,
      page: 1.8,
    });

    expect(params.toString()).toBe("q=doctor&rating=5&page=1");
  });

  it("resets page when a filter or sort changes", () => {
    const current = { ...DEFAULT_SEARCH_URL_STATE, city: "tashkent", page: 4 };

    expect(patchSearchUrlState(current, { specialty: "surgeon" }).page).toBe(0);
    expect(patchSearchUrlState(current, { sort: "price-desc" }).page).toBe(0);
  });

  it("retains page for view changes and accepts an explicit page change", () => {
    const current = { ...DEFAULT_SEARCH_URL_STATE, page: 4 };

    expect(patchSearchUrlState(current, { view: "grid" }).page).toBe(4);
    expect(patchSearchUrlState(current, { page: 2 }).page).toBe(2);
  });
});
