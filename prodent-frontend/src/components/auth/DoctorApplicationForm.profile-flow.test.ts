import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("DoctorApplicationForm profile creation regression", () => {
  it("keeps profile data mutable when a missing profile is created", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/auth/DoctorApplicationForm.tsx"),
      "utf8",
    );

    expect(source).toContain("let profileData = profileResult.data");
    expect(source).toContain("profileData = newProfile");
    expect(source).not.toMatch(/const\s*\{[^}]*profileData[^}]*\}\s*=\s*await/);
  });
});
