import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PatientFiles dialog bundle split", () => {
  it("keeps heavy file dialogs out of the eager patient files bundle", () => {
    const source = readSource("src/components/crm/PatientFiles.tsx");

    expect(source).not.toMatch(/import\s+\{\s*UploadFileDialog\s*\}\s+from/);
    expect(source).not.toMatch(/import\s+\{\s*FileViewer\s*\}\s+from/);
    expect(source).not.toMatch(/import\s+\{\s*CompareFilesDialog\s*\}\s+from/);

    expect(source).toContain('import("./files/UploadFileDialog")');
    expect(source).toContain('import("./files/FileViewer")');
    expect(source).toContain('import("./files/CompareFilesDialog")');
  });

  it("keeps the 3D and zoom dependencies behind the dialog components", () => {
    const fileViewerSource = readSource("src/components/crm/files/FileViewer.tsx");
    const compareSource = readSource("src/components/crm/files/CompareFilesDialog.tsx");

    expect(fileViewerSource).toContain("react-zoom-pan-pinch");
    expect(compareSource).toContain("react-zoom-pan-pinch");
    expect(fileViewerSource).toContain('import("./STLViewer")');
  });
});
