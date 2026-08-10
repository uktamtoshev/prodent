import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const readSource = (filePath: string) => readFileSync(resolve(projectRoot, filePath), "utf8");

describe("profile map bundle boundaries", () => {
  it("keeps Leaflet out of eager doctor and clinic profile shells", () => {
    const clinicHeaderSource = readSource("src/components/clinic/profile/ClinicProfileHeader.tsx");
    const clinicAboutSource = readSource("src/components/clinic/profile/ClinicAbout.tsx");
    const doctorLocationSource = readSource("src/components/doctor/profile/DoctorLocationMap.tsx");

    for (const source of [clinicHeaderSource, clinicAboutSource, doctorLocationSource]) {
      expect(source).not.toMatch(/from ['"]leaflet['"]/);
      expect(source).not.toContain("leaflet/dist/leaflet.css");
    }

    expect(clinicHeaderSource).toContain("import('./ClinicMiniMap')");
    expect(clinicAboutSource).toContain("import('./ClinicAboutMap')");
    expect(doctorLocationSource).toContain("import('./DoctorLocationLeafletMap')");
  });

  it("loads Leaflet only inside dedicated map chunks", () => {
    const miniMapSource = readSource("src/components/clinic/profile/ClinicMiniMap.tsx");
    const clinicAboutMapSource = readSource("src/components/clinic/profile/ClinicAboutMap.tsx");
    const doctorMapSource = readSource("src/components/doctor/profile/DoctorLocationLeafletMap.tsx");

    for (const source of [miniMapSource, clinicAboutMapSource, doctorMapSource]) {
      expect(source).toMatch(/from ['"]leaflet['"]/);
      expect(source).toContain("leaflet/dist/leaflet.css");
    }
  });
});
