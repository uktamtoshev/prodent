import { describe, expect, it } from "vitest";
import { getPublicPromotionTarget, isPublicPromotionCurrent } from "./publicPromotion";

describe("public promotion navigation", () => {
  it("sends a doctor promotion straight to booking with promotion context", () => {
    expect(
      getPublicPromotionTarget({
        id: "promo 1",
        doctor_id: "doctor/1",
        clinic_id: "clinic-1",
      }),
    ).toBe("/book/doctor%2F1?promo=promo+1");
  });

  it("keeps a clinic-only promotion on the clinic profile with context", () => {
    expect(
      getPublicPromotionTarget({
        id: "promo-2",
        doctor_id: null,
        clinic_id: "clinic-2",
      }),
    ).toBe("/clinic/clinic-2?promo=promo-2");
  });

  it("falls back to doctor search when a promotion has no provider", () => {
    expect(getPublicPromotionTarget({ id: "promo-3" })).toBe("/search?promo=promo-3");
  });
});

describe("public promotion validity", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("rejects disabled and expired promotions", () => {
    expect(isPublicPromotionCurrent({ active: false, valid_until: null }, now)).toBe(false);
    expect(
      isPublicPromotionCurrent({ active: true, valid_until: "2026-07-24T11:59:59.000Z" }, now),
    ).toBe(false);
  });

  it("keeps future and open-ended promotions", () => {
    expect(
      isPublicPromotionCurrent({ active: true, valid_until: "2026-07-24T12:00:00.000Z" }, now),
    ).toBe(true);
    expect(isPublicPromotionCurrent({ active: true, valid_until: null }, now)).toBe(true);
  });

  it("keeps a date-only promotion active through its final day", () => {
    expect(
      isPublicPromotionCurrent(
        { active: true, valid_until: "2026-07-24" },
        new Date("2026-07-24T18:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
