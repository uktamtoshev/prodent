import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const LEGACY_DATABASE_FIELDS = /\b(?:plan_number|final_price|plan_id)\b/;

describe("treatment-plan schema boundary", () => {
  it.each([
    ["legacy CRM card", "../TreatmentPlan.tsx"],
    ["legacy medical view", "../medical/TreatmentPlanView.tsx"],
    ["legacy create dialog", "../medical/CreateTreatmentPlanDialog.tsx"],
  ])("keeps %s as a compatibility wrapper", (_label, relativePath) => {
    const source = readSource(relativePath);

    expect(source).not.toMatch(/\.from\(["']treatment_plans["']\)/);
    expect(source).not.toMatch(/\.from\(["']treatment_plan_items["']\)/);
    expect(source).not.toMatch(LEGACY_DATABASE_FIELDS);
  });

  it.each([
    ["REST adapter", "../../../lib/treatment-plans-api.ts"],
    ["plan form", "./TreatmentPlanForm.tsx"],
    ["plan list", "./TreatmentPlansList.tsx"],
    ["print dialog", "./TreatmentPlanPrintDialog.tsx"],
    ["treatment history", "../medical/TreatmentHistory.tsx"],
    ["CRM medical-record page", "../../../pages/crm/MedicalRecords.tsx"],
    ["doctor medical-record page", "../../../pages/doctor/DoctorMedicalRecords.tsx"],
    ["doctor plan list", "../../../pages/doctor/DoctorTreatmentPlans.tsx"],
    ["doctor plan editor", "../../../pages/doctor/DoctorPlanEdit.tsx"],
    ["quick procedure menu", "../../patient/dental/QuickProcedureMenu.tsx"],
    ["public plan", "../../../pages/TreatmentPlanPublic.tsx"],
  ])("does not reintroduce legacy fields in %s", (_label, relativePath) => {
    expect(readSource(relativePath)).not.toMatch(LEGACY_DATABASE_FIELDS);
  });
});
