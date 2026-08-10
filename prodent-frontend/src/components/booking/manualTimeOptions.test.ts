import { describe, expect, it } from "vitest";

import {
  getAvailableManualTimeOptions,
  MINIMUM_BOOKING_DURATION_MINUTES,
} from "./manualTimeOptions";

describe("manual booking time options", () => {
  it("hides times that have already passed today in Tashkent", () => {
    const options = getAvailableManualTimeOptions({
      selectedDate: "2026-08-03",
      durationMinutes: 45,
      now: new Date("2026-08-03T05:07:00.000Z"), // 10:07 in Tashkent
    });

    expect(options[0]).toBe("10:15");
    expect(options).not.toContain("10:00");
  });

  it("hides times whose selected duration reaches the next day", () => {
    const options = getAvailableManualTimeOptions({
      selectedDate: "2026-08-04",
      durationMinutes: 45,
      now: new Date("2026-08-03T05:07:00.000Z"),
    });

    expect(options.at(-1)).toBe("23:00");
    expect(options).not.toContain("23:15");
  });

  it("uses the minimum duration when no service duration is available", () => {
    const options = getAvailableManualTimeOptions({
      selectedDate: "2026-08-04",
      durationMinutes: null,
      now: new Date("2026-08-03T05:07:00.000Z"),
    });

    expect(MINIMUM_BOOKING_DURATION_MINUTES).toBe(30);
    expect(options.at(-1)).toBe("23:15");
    expect(options).not.toContain("23:30");
  });

  it("returns no manual times for a past date", () => {
    expect(getAvailableManualTimeOptions({
      selectedDate: "2026-08-02",
      durationMinutes: 30,
      now: new Date("2026-08-03T05:07:00.000Z"),
    })).toEqual([]);
  });
});
