import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const completedRolePages = [
  "src/pages/clinic-admin/ClinicAdminSchedule.tsx",
  "src/pages/clinic-admin/ClinicAdminAppointments.tsx",
  "src/pages/clinic-admin/ClinicAdminPatients.tsx",
  "src/pages/clinic-admin/ClinicAdminPayments.tsx",
  "src/pages/clinic-admin/ClinicAdminPromotions.tsx",
  "src/pages/clinic-admin/ClinicAdminSettings.tsx",
  "src/pages/assistant/AssistantSchedule.tsx",
  "src/pages/assistant/AssistantRooms.tsx",
  "src/pages/assistant/AssistantMaterials.tsx",
  "src/pages/assistant/AssistantAppointments.tsx",
  "src/pages/accountant/AccountantInvoices.tsx",
  "src/pages/accountant/AccountantPayments.tsx",
  "src/pages/accountant/AccountantSalaries.tsx",
  "src/pages/manager/ManagerDashboard.tsx",
  "src/pages/manager/ManagerKPI.tsx",
  "src/pages/manager/ManagerAnalytics.tsx",
  "src/pages/manager/ManagerStaff.tsx",
];

describe("Sprint 8 staff role pages", () => {
  it("replaces every role UnderConstruction page with an operational surface", () => {
    for (const file of completedRolePages) {
      const page = source(file);
      expect(page, file).not.toContain("UnderConstruction");
      expect(page, file).toMatch(/Operations|SalariesList|UsersManager|PermissionsManager/);
    }
  });

  it("uses the dedicated clinic and warehouse APIs instead of mock data", () => {
    const operations = source(
      "src/components/staff-operations/StaffOperations.tsx",
    );
    expect(operations).toContain("getClinicSchedule");
    expect(operations).toContain("searchClinicPatients");
    expect(operations).toContain("listClinicInvoices");
    expect(operations).toContain("listReportOperations");
    expect(operations).toContain("getReportSummary");
    expect(operations).toContain("sklad.stats()");
    expect(operations).toContain("sklad.listItems");
  });

  it("keeps mobile-first cards and bounded financial rendering", () => {
    const operations = source(
      "src/components/staff-operations/StaffOperations.tsx",
    );
    expect(operations).toContain("grid gap-3 md:grid-cols-2");
    expect(operations).toContain("rows.slice(0, 50)");
    expect(operations).toContain('size: 100');
    expect(operations).toContain('role="alert"');
  });

  it("keeps every role group behind the shared route boundary", () => {
    for (const file of [
      "src/routes/clinic-admin-routes.tsx",
      "src/routes/assistant-routes.tsx",
      "src/routes/accountant-routes.tsx",
      "src/routes/manager-routes.tsx",
    ]) {
      expect(source(file), file).toContain("<RoleRouteBoundary group=");
    }
  });

  it("gates medical routes and patient data before rendering", () => {
    expect(source("src/routes/crm-routes.tsx")).toContain(
      '<RoleRouteBoundary group="medical">',
    );
    expect(source("src/routes/doctor-routes.tsx")).toContain(
      '<RoleRouteBoundary group="medical">',
    );
    const directMedical = source(
      "src/pages/doctor/DoctorMedicalRecords.tsx",
    );
    expect(directMedical).toContain("medicalAccessApi.effective(patientId)");
    expect(directMedical).toContain("enabled: hasAccess");
    expect(directMedical).toContain("enabled: hasAccess && !!patientId");
  });

  it("keys assistant materials by the selected clinic", () => {
    const operations = source(
      "src/components/staff-operations/StaffOperations.tsx",
    );
    expect(operations).toContain(
      'queryKey: ["s8-assistant-materials", currentClinic?.id]',
    );
  });
});
