import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auth application form code splitting", () => {
  it("keeps verification application forms out of eager auth imports", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/Auth.tsx"), "utf8");

    const eagerApplicationFormImport =
      /import\s+\{[^}]*ApplicationForm[^}]*\}\s+from\s+["']@\/components\/auth\/(?:DoctorApplicationForm|ClinicApplicationForm|TechnicianApplicationForm|SupplierApplicationForm)["']/;

    expect(source).not.toMatch(eagerApplicationFormImport);
    expect(source).toContain('import("@/components/auth/DoctorApplicationForm")');
    expect(source).toContain('import("@/components/auth/ClinicApplicationForm")');
    expect(source).toContain('import("@/components/auth/TechnicianApplicationForm")');
    expect(source).toContain('import("@/components/auth/SupplierApplicationForm")');
  });
});
