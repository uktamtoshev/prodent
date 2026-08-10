import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/pages/doctor/DoctorMyDay.tsx", "utf8");

describe("DoctorMyDay Sprint 4 integration", () => {
  it("turns appointment and doctor query failures into a retryable error state", () => {
    expect(source).toContain("getDoctorMyDayAppointments()");
    expect(source).toContain("if (error) throw error");
    expect(source).toContain('data-testid="doctor-my-day-error"');
    expect(source).toContain("retrySchedule");
  });

  it("uses the protected My Day contract and explicit Tashkent time", () => {
    expect(source).toContain("getDoctorMyDayStatus(row.status, start)");
    expect(source).toContain("getTashkentCalendarDate()");
    expect(source).not.toContain('if (t < now - 15 * 60_000) return "done"');
  });
});
