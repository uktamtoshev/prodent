import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const modalSource = readFileSync(
  resolve(process.cwd(), "src/components/crm/calendar/AppointmentModal.tsx"),
  "utf8",
);
const visitSource = readFileSync(
  resolve(process.cwd(), "src/pages/doctor/DoctorVisit.tsx"),
  "utf8",
);

describe("appointment completion boundary", () => {
  it("does not offer a calendar shortcut that bypasses the clinical visit form", () => {
    expect(modalSource).not.toContain('{ status: "COMPLETED"');
    expect(modalSource).toContain("setAppointmentStatus");
  });

  it("keeps completion in the doctor visit flow with the clinical request", () => {
    expect(visitSource).toContain('supabase.functions.invoke("finish-visit"');
    expect(visitSource).toContain("expectedVersion");
    expect(visitSource).toContain("diagnosis");
  });
});
