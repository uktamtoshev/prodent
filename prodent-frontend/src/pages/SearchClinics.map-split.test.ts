import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("search and clinics map bundle split", () => {
  it("keeps Leaflet map dialogs out of the eager search and clinics page bundles", () => {
    const searchSource = readSource("src/pages/Search.tsx");
    const clinicsSource = readSource("src/pages/Clinics.tsx");

    expect(searchSource).not.toMatch(/import\s+\{\s*DoctorsMapDialog\s*\}\s+from/);
    expect(clinicsSource).not.toMatch(/import\s+\{\s*ClinicsMapDialog\s*\}\s+from/);

    expect(searchSource).toContain('import("@/components/search/DoctorsMapDialog")');
    expect(clinicsSource).toContain('import("@/components/search/ClinicsMapDialog")');
  });

  it("keeps Leaflet inside the map dialog components", () => {
    const doctorsMapSource = readSource("src/components/search/DoctorsMapDialog.tsx");
    const clinicsMapSource = readSource("src/components/search/ClinicsMapDialog.tsx");

    expect(doctorsMapSource).toMatch(/from ['"]leaflet['"]/);
    expect(clinicsMapSource).toMatch(/from ['"]leaflet['"]/);
  });
});
