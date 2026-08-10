import { describe, expect, it } from "vitest";
import { isBookingPromotionApplicable } from "./bookingPromotion";

const CURRENT = {
  id: "promo-1",
  active: true,
  valid_until: "2099-01-01",
  doctor_id: "doctor-1",
  clinic_id: null,
};

describe("booking promotion", () => {
  it("accepts a current promotion owned by the doctor or clinic", () => {
    expect(isBookingPromotionApplicable(CURRENT, "doctor-1", "clinic-1")).toBe(true);
    expect(isBookingPromotionApplicable(
      { ...CURRENT, doctor_id: null, clinic_id: "clinic-1" },
      "doctor-1",
      "clinic-1",
    )).toBe(true);
  });

  it("rejects expired, inactive, or unrelated promotions", () => {
    expect(isBookingPromotionApplicable({ ...CURRENT, active: false }, "doctor-1", "clinic-1")).toBe(false);
    expect(isBookingPromotionApplicable({ ...CURRENT, valid_until: "2020-01-01" }, "doctor-1", "clinic-1")).toBe(false);
    expect(isBookingPromotionApplicable({ ...CURRENT, doctor_id: "doctor-2" }, "doctor-1", "clinic-1")).toBe(false);
  });
});
