import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("application forms cropper bundle split", () => {
  it("keeps image cropper out of eager doctor and clinic application form bundles", () => {
    const doctorSource = readSource("src/components/auth/DoctorApplicationForm.tsx");
    const clinicSource = readSource("src/components/auth/ClinicApplicationForm.tsx");
    const cropperSource = readSource("src/components/ui/avatar-cropper.tsx");

    for (const source of [doctorSource, clinicSource]) {
      expect(source).toContain('import("@/components/ui/avatar-cropper")');
      expect(source).not.toMatch(/import\s+\{\s*AvatarCropper\s*\}\s+from\s+['"]@\/components\/ui\/avatar-cropper['"]/);
      expect(source).toContain("<Suspense fallback={null}>");
    }

    expect(cropperSource).toContain("react-image-crop");
  });
});
