import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("admin promotions cropper bundle split", () => {
  it("keeps the image cropper out of the eager promotions page bundle", () => {
    const source = readSource("src/pages/admin/Promotions.tsx");
    const cropperSource = readSource("src/components/ui/avatar-cropper.tsx");

    expect(source).toContain("import('@/components/ui/avatar-cropper')");
    expect(source).not.toMatch(/import\s+\{\s*AvatarCropper\s*\}\s+from\s+['"]@\/components\/ui\/avatar-cropper['"]/);
    expect(cropperSource).toContain("react-image-crop");
  });
});
