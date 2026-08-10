import { describe, expect, it } from "vitest";

import { getTashkentCalendarDate, toCalendarDateKey } from "./tashkentTime";

describe("Tashkent calendar time", () => {
  it("uses the next Tashkent day while UTC is still on the previous day", () => {
    const calendarDate = getTashkentCalendarDate(
      new Date("2026-07-24T20:30:00.000Z"),
    );

    expect(toCalendarDateKey(calendarDate)).toBe("2026-07-25");
  });

  it("keeps the selected calendar date stable", () => {
    expect(toCalendarDateKey(new Date(2026, 6, 25, 23, 59))).toBe("2026-07-25");
  });
});
