import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CRM patients reference route", () => {
  const mainSource = readFileSync(
    resolve(process.cwd(), "src/pages/doctor/DoctorPatients.tsx"),
    "utf8",
  );
  const legacySource = readFileSync(
    resolve(process.cwd(), "src/pages/crm/Patients.tsx"),
    "utf8",
  );
  const topbarSource = readFileSync(
    resolve(process.cwd(), "src/components/doctor/DoctorTopbar.tsx"),
    "utf8",
  );
  // The page header (title, subtitle, search, bell) moved out of DoctorTopbar
  // into the cabinet's single top bar; DoctorTopbar now only publishes into it.
  const cabinetBarSource = readFileSync(
    resolve(process.cwd(), "src/components/shared/CabinetTopBar.tsx"),
    "utf8",
  );
  const crmRoutesSource = readFileSync(
    resolve(process.cwd(), "src/routes/crm-routes.tsx"),
    "utf8",
  );

  it("uses the clinic-scoped Sprint 7 patient page on the primary CRM route", () => {
    expect(crmRoutesSource).toContain('path: "/crm/patients"');
    expect(crmRoutesSource).toContain('page: "Patients"');
    expect(legacySource).toContain("searchClinicPatients");
    expect(legacySource).toContain("mergeDuplicatePatients");
  });

  it("uses shared page, statistics, loading, error and empty components", () => {
    expect(mainSource).toContain("<PageHeader");
    expect(mainSource.match(/<StatCard/g)).toHaveLength(3);
    expect(mainSource).toContain("<SkeletonComposition");
    expect(mainSource).toContain("<ErrorState");
    expect(mainSource).toContain("<EmptyState");
  });

  it("keeps the real patient create and navigation actions", () => {
    expect(mainSource).toContain("<AddNewPatientDialog");
    expect(mainSource).toContain("setAddPatientOpen(true)");
    expect(mainSource).toContain("navigate(`/doctor/patients/${p.id}`)");
  });

  it("keeps the reference page and topbar dark-safe", () => {
    const forbiddenLightOnlyTokens = /\b(?:bg-white(?:\/\d+)?|text-slate-\d+|border-slate-\d+|ring-white)\b/;

    expect(mainSource).not.toMatch(forbiddenLightOnlyTokens);
    expect(topbarSource).not.toMatch(forbiddenLightOnlyTokens);
    expect(cabinetBarSource).not.toMatch(forbiddenLightOnlyTokens);
    expect(mainSource).toContain("bg-primary");
    expect(mainSource).toContain("text-primary-foreground");
  });

  it("names search controls and exposes selected patient segment", () => {
    expect(mainSource).toContain(
      'aria-label={t("doctorPatients.searchPlaceholder")}',
    );
    expect(mainSource).toContain('aria-label={t("doctor.resetFilters")}');
    expect(mainSource).toContain("aria-pressed={a}");
    expect(cabinetBarSource).toContain("aria-label={searchPlaceholder}");
  });

  it("opens a patient from the keyboard without hiding row actions on focus", () => {
    expect(mainSource).toContain(
      "aria-label={`${labels.openMedicalCard}: ${name}`}",
    );
    expect(mainSource).toContain("event.stopPropagation();");
    expect(mainSource).toContain("group-focus-within:opacity-100");
  });

  it("retries only the active clinic patient query", () => {
    expect(legacySource).not.toContain(
      "Promise.all([refetchClinicPatients(), refetchPersonalPatients()])",
    );
    expect(legacySource).toContain("patients.refetch()");
  });
});
