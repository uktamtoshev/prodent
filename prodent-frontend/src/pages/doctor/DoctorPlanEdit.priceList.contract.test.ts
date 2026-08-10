import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/doctor/DoctorPlanEdit.tsx"),
  "utf8",
);

/**
 * Treatment-plan items link to the clinic's price list.
 *
 * They used to be pure free text: the doctor typed a name and a price by hand,
 * so `service_id` was NULL on every row ever created. That is a data problem,
 * not a typing inconvenience — the plan could not be reconciled against the
 * catalogue, finance and reports had nothing to group by, and two doctors billed
 * the same procedure at prices they remembered differently.
 *
 * Free text stays supported on purpose (one-off work; a clinic whose catalogue
 * is still empty), so this contract pins the LINK, not the removal of typing.
 */
describe("DoctorPlanEdit price list contract", () => {
  it("loads the clinic catalogue for the plan's clinic and language", () => {
    expect(source).toContain("loadActiveClinicServiceOptions");
    expect(source).toContain("plan!.clinic_id");
    // Localized names: the catalogue helper resolves per language.
    expect(source).toContain('queryKey: ["plan-edit-services", plan?.clinic_id, language]');
  });

  it("fills name, price and the service_id link from one pick", () => {
    expect(source).toContain("const pickService");
    expect(source).toContain("service_id: option.id");
    expect(source).toContain("description: option.name");
    expect(source).toContain("unit_price: option.price");
  });

  it("detaches the link when the line is retyped by hand", () => {
    // A renamed line keeping its old service_id would be a false link — worse
    // than no link, because reports would trust it.
    expect(source).toMatch(
      /description: e\.target\.value,\s*\n\s*service_id: null,/,
    );
  });

  it("still allows a custom line and says so", () => {
    expect(source).toContain('t("doctorPlanEdit.pickFromPriceList")');
    expect(source).toContain('t("doctorPlanEdit.customServiceHint")');
  });

  it("localizes both new labels in all six languages", () => {
    for (const lang of ["ru", "uz", "uz_cyrl", "kz", "kg", "tj"]) {
      const locale = readFileSync(
        resolve(process.cwd(), `src/i18n/locales/${lang}.doctor-treatment.ts`),
        "utf8",
      );
      for (const key of ["pickFromPriceList", "customServiceHint"]) {
        expect(locale, `${lang} is missing doctorPlanEdit.${key}`).toContain(
          `${key}:`,
        );
      }
    }
  });
});
