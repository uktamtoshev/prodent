import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("profile tab bundle split", () => {
  it("keeps inactive clinic tabs out of the eager clinic profile route", () => {
    const source = readSource("src/pages/ClinicProfile.tsx");

    expect(source).toContain("import('@/components/clinic/profile/ClinicPortfolio')");
    expect(source).toContain("import('@/components/clinic/profile/ClinicReviews')");
    expect(source).toContain("import('@/components/profile/ProfileReels')");
    expect(source).not.toMatch(/import\s+\{\s*ClinicPortfolio\s*\}\s+from/);
    expect(source).not.toMatch(/import\s+\{\s*ProfileReels\s*\}\s+from/);
    expect(source).toMatch(/import\s+\{\s*ClinicTimeline\s*\}\s+from/);
  });

  it("keeps inactive doctor tabs out of the eager doctor profile route", () => {
    const source = readSource("src/pages/doctor/DoctorPublicProfile.tsx");

    expect(source).toContain('import("@/components/doctor/profile/DoctorPortfolio")');
    expect(source).toContain('import("@/components/doctor/profile/DoctorReviews")');
    expect(source).toContain('import("@/components/profile/ProfileArticles")');
    expect(source).not.toMatch(/import\s+\{\s*DoctorPortfolio\s*\}\s+from/);
    expect(source).not.toMatch(/import\s+\{\s*ProfileArticles\s*\}\s+from/);
    expect(source).toMatch(/import\s+\{\s*DoctorTimeline\s*\}\s+from/);
  });
});
