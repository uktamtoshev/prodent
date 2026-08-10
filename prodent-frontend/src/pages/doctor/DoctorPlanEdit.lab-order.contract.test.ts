import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/pages/doctor/DoctorPlanEdit.tsx", "utf8");

describe("DoctorPlanEdit lab order action", () => {
  it("opens a lab order from a persisted treatment-plan item", () => {
    expect(source).toContain("buildDoctorLabOrderPath");
    expect(source).toContain("treatmentPlanId: plan.id");
    expect(source).toContain("treatmentPlanItemId: r.id");
    expect(source).not.toContain("patientName:");
  });
});
