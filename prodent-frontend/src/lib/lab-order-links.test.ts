import { describe, expect, it } from "vitest";
import { buildDoctorLabOrderPath } from "./lab-order-links";

describe("doctor lab order deep link", () => {
  it("links a persisted treatment-plan item without putting patient PHI in the URL", () => {
    const path = buildDoctorLabOrderPath({
      patientId: "patient/1",
      treatmentPlanId: "plan+1",
      treatmentPlanItemId: "item 1",
    });

    expect(path).toBe(
      "/doctor/laboratory?patient_id=patient%2F1&treatment_plan_id=plan%2B1&treatment_plan_item_id=item+1",
    );
    expect(path).not.toContain("patient_name");
  });

  it("supports an order linked to the whole plan", () => {
    expect(
      buildDoctorLabOrderPath({
        patientId: "patient-1",
        treatmentPlanId: "plan-1",
      }),
    ).toBe(
      "/doctor/laboratory?patient_id=patient-1&treatment_plan_id=plan-1",
    );
  });
});
