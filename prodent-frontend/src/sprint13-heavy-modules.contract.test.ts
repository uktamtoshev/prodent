import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("Sprint 13 heavy modules stay out of eager route graphs", () => {
  it("loads every Leaflet implementation through a lazy boundary", () => {
    const cases = [
      ["src/pages/Search.tsx", "@/components/search/DoctorsMapDialog"],
      ["src/pages/Clinics.tsx", "@/components/search/ClinicsMapDialog"],
      ["src/components/auth/LocationSelector.tsx", "./MapPicker"],
      [
        "src/components/doctor/profile/DoctorAbout.tsx",
        "./InlineEditDialogs",
      ],
      [
        "src/components/doctor/profile/DoctorLocationMap.tsx",
        "./DoctorLocationLeafletMap",
      ],
      [
        "src/components/clinic/profile/ClinicProfileHeader.tsx",
        "./ClinicMiniMap",
      ],
    ] as const;

    for (const [shellPath, heavyModule] of cases) {
      const source = read(shellPath);
      expect(source, shellPath).toMatch(
        new RegExp(`import\\((?:'|")${escapeRegExp(heavyModule)}(?:'|")\\)`),
      );
      expect(source, shellPath).not.toMatch(
        new RegExp(
          `(?:from\\s+["']${heavyModule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'])`,
        ),
      );
    }
  });

  it("loads 3D, PDF, charts and markdown only through dynamic imports", () => {
    const boundaries = [
      ["src/components/patient/dental/FDI3DDentalChart.tsx", "./DentalScene3D"],
      ["src/components/crm/files/FileViewer.tsx", "./STLViewer"],
      [
        "src/lib/treatment-plan-pdf-dependencies.ts",
        'import("html2canvas")',
      ],
      ["src/lib/treatment-plan-pdf-dependencies.ts", 'import("jspdf")'],
      [
        "src/components/admin/ads/CampaignAnalyticsDialog.tsx",
        "import('./CampaignPerformanceChart')",
      ],
      [
        "src/components/crm/finance/DoctorPersonalIncome.tsx",
        'import("./DoctorPersonalIncomeChart")',
      ],
      [
        "src/pages/ArticleDetail.tsx",
        'import("@/components/articles/ArticleMarkdown")',
      ],
      [
        "src/components/articles/ArticleMarkdown.tsx",
        'import("@/components/articles/ArticleMarkdownRenderer")',
      ],
    ] as const;

    for (const [shellPath, expectedImport] of boundaries) {
      expect(read(shellPath), shellPath).toContain(expectedImport);
    }
  });
});
