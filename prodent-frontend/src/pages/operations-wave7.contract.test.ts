import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const sources = {
  adminAppointments: readSource("src/pages/admin/Appointments.tsx"),
  adminUsers: readSource("src/pages/admin/Users.tsx"),
  clinicAppointments: readSource(
    "src/pages/clinic-admin/ClinicAdminAppointments.tsx",
  ),
  clinicPatients: readSource(
    "src/pages/clinic-admin/ClinicAdminPatients.tsx",
  ),
  crmAppointments: readSource("src/pages/crm/Appointments.tsx"),
  crmPatients: readSource("src/pages/crm/Patients.tsx"),
};

describe("wave 7 operations safety contracts", () => {
  it("keeps clinic and CRM wrappers connected to their shared operations", () => {
    expect(sources.clinicAppointments).toContain("<ScheduleOperations");
    expect(sources.clinicPatients).toContain("<PatientOperations");
    expect(sources.crmAppointments).toContain('to="/crm/schedule"');
  });

  it("keeps the admin appointment table responsive and explicit about failures", () => {
    expect(sources.adminAppointments).toContain("if (error) throw error");
    expect(sources.adminAppointments).toContain("<TableCaption");
    expect(sources.adminAppointments).toContain('scope="col"');
    expect(sources.adminAppointments).toContain('className="min-w-[760px]"');
    expect(sources.adminAppointments).toContain('role="alert"');
    expect(sources.adminAppointments).toContain("refetch");
  });

  it("requires confirmation for role removal and patient merge", () => {
    expect(sources.adminUsers).toContain("pendingRoleRemoval");
    expect(sources.adminUsers).toContain("<AlertDialog");
    expect(sources.crmPatients).toContain("pendingMerge");
    expect(sources.crmPatients).toContain("<AlertDialog");
    expect(sources.crmPatients).toContain(
      "disabled={!pendingMerge || merge.isPending}",
    );
  });
});
