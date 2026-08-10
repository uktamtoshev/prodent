import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("clinic profile accessibility contracts", () => {
  it("keeps tabs semantic, keyboard reachable, and horizontally bounded", () => {
    const source = readSource("src/components/clinic/profile/ClinicProfileTabs.tsx");

    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain("aria-selected");
    expect(source).toContain("aria-controls");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("min-h-11");
    expect(source).toContain("allTabs.map");
    expect(source).not.toContain("DropdownMenu");
    expect(source).not.toContain("clinic-profile-tab-more");
  });

  it("keeps public profile actions and uploads labelled and touch-sized", () => {
    const source = readSource("src/components/clinic/profile/ClinicProfileHeader.tsx");

    expect(source).toContain('id="clinic-cover-upload"');
    expect(source).toContain('id="clinic-logo-upload"');
    expect(source).toContain('aria-label="Дополнительные действия"');
    expect(source).toContain("h-11 w-11");
    expect(source).not.toContain("bg-gray-100");
    expect(source).not.toContain("text-green-700");
  });

  it("connects form labels and constrains profile content at 360px", () => {
    const settings = readSource("src/components/clinic/profile/ClinicSettings.tsx");
    const portfolio = readSource("src/components/clinic/profile/ClinicPortfolio.tsx");
    const page = readSource("src/pages/ClinicProfile.tsx");

    expect(settings).toContain("clinic-settings-${k}");
    expect(settings).toContain("<Label htmlFor={inputId}>");
    expect(portfolio).toContain('htmlFor="clinic-portfolio-title"');
    expect(portfolio).toContain('id="clinic-portfolio-title"');
    expect(portfolio).toContain("min-h-11");
    expect(page).toContain('role="tabpanel"');
    expect(page).toContain("overflow-x-clip");
    expect(page).toContain("min-w-0 max-w-full");
  });
});
