import { describe, expect, it } from "vitest";
import { getDoctorMyDayStatus } from "./doctorMyDayStatus";

const NOW = new Date("2026-07-24T10:00:00+05:00").getTime();

describe("doctor my day status", () => {
  it("keeps completed appointments done", () => {
    expect(getDoctorMyDayStatus("completed", new Date(NOW - 60_000), NOW)).toBe("done");
  });

  it("keeps an explicitly started appointment live", () => {
    expect(getDoctorMyDayStatus("in_progress", new Date(NOW - 60_000), NOW)).toBe("now");
  });

  it.each(["pending", "confirmed", null])(
    "does not mark an old unfinished %s appointment done",
    (status) => {
      expect(getDoctorMyDayStatus(status, new Date(NOW - 60 * 60_000), NOW)).toBe(
        "upcoming",
      );
    },
  );

  it("marks a near future appointment as next", () => {
    expect(getDoctorMyDayStatus("confirmed", new Date(NOW + 20 * 60_000), NOW)).toBe(
      "next",
    );
  });
});
