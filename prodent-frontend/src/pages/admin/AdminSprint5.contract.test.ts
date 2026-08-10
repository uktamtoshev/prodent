import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Sprint 5 central admin contracts", () => {
  it("requires and stores a reason for approval and rejection", () => {
    const verification = source("src/pages/admin/Verification.tsx");

    expect(verification).toContain("submitVerificationDecision");
    expect(verification).toContain('"doctor", applicationId, "approved", reason');
    expect(verification).toContain('"clinic", applicationId, "rejected", reason');
    expect(verification).toContain('"technician", applicationId, "approved", reason');
    expect(verification).toContain('"supplier", applicationId, "rejected", reason');
    expect(verification).toContain("review_reason");
    expect(verification).toContain("reviewed_by");
    expect(verification).toContain("reviewReason");
    expect(verification).not.toContain("approveDoctorMutation.mutate(app.id)");
    expect(verification).not.toContain("approveClinicMutation.mutate(app.id)");
    expect(verification).not.toContain("approveTechnicianMutation.mutate(app.id)");
    expect(verification).not.toContain("approveSupplierMutation.mutate(app.id)");
  });

  it("shows reviewer and reason for completed decisions", () => {
    const verification = source("src/pages/admin/Verification.tsx");

    expect(verification).toContain("reviewerId");
    expect(verification).toContain("reason");
    expect(verification).toContain("app.review_reason");
  });

  it("routes clinic verification through the queue", () => {
    const clinics = source("src/pages/admin/Clinics.tsx");

    expect(clinics).toContain('to="/admin/verification"');
    expect(clinics).not.toContain(".update({ is_verified:");
  });

  it("only renders role management controls for super admins", () => {
    const users = source("src/pages/admin/Users.tsx");

    expect(users).toContain("const { isSuperAdmin } = useAdmin()");
    expect(users).toMatch(/\{isSuperAdmin && \(\s*<button[\s\S]*removeRole/);
    expect(users).toMatch(/\{isSuperAdmin && \(\s*<div className="flex gap-2">/);
  });

  it("bounds users, roles and patients on the server", () => {
    const users = source("src/pages/admin/Users.tsx");
    const patients = source("src/pages/admin/Patients.tsx");

    expect(users).toContain(".range(");
    expect(users).toContain(".in('user_id'");
    expect(users).not.toContain(".from('user_roles')\n        .select('*')");

    expect(patients).toContain("searchSupportPatients");
    expect(patients).toContain("appliedReason");
    expect(patients).not.toContain("appointments!appointments_patient_id_fkey");
    expect(patients).not.toContain(".from('appointments')");
  });
});
