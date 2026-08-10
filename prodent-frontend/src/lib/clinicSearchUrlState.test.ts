import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLINIC_SEARCH_URL_STATE,
  parseClinicSearchUrlState,
  patchClinicSearchUrlState,
  serializeClinicSearchUrlState,
} from "./clinicSearchUrlState";

describe("clinic search URL state", () => {
  it("round-trips supported filters in a canonical order", () => {
    const state = parseClinicSearchUrlState(
      "?page=2&view=map&district=chilanzar&city=tashkent&q=family&sort=rating",
    );

    expect(state).toEqual({
      q: "family",
      city: "tashkent",
      district: "chilanzar",
      sort: "rating",
      view: "map",
      page: 2,
    });
    expect(serializeClinicSearchUrlState(state).toString()).toBe(
      "q=family&city=tashkent&district=chilanzar&sort=rating&view=map&page=2",
    );
  });

  it("omits defaults, rejects unknown values, and resets page after a filter change", () => {
    expect(
      parseClinicSearchUrlState("?sort=nope&view=nope&page=-8"),
    ).toEqual(DEFAULT_CLINIC_SEARCH_URL_STATE);
    expect(serializeClinicSearchUrlState(DEFAULT_CLINIC_SEARCH_URL_STATE).toString()).toBe("");
    expect(
      patchClinicSearchUrlState(
        { ...DEFAULT_CLINIC_SEARCH_URL_STATE, page: 7 },
        { city: "samarkand" },
      ).page,
    ).toBe(0);
  });
});
