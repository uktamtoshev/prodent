import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("admin verification bundle split", () => {
  it("keeps edit application dialogs out of the eager verification route", () => {
    const source = readSource("src/pages/admin/Verification.tsx");

    expect(source).toContain('import("@/components/admin/EditDoctorApplicationDialog")');
    expect(source).toContain('import("@/components/admin/EditClinicApplicationDialog")');
    expect(source).not.toMatch(/import\s+\{\s*EditDoctorApplicationDialog\s*,/);
    expect(source).not.toMatch(/import\s+\{\s*EditClinicApplicationDialog\s*,/);
    expect(source).toContain("editingDoctor ? (");
    expect(source).toContain("editingClinic ? (");
  });
});
