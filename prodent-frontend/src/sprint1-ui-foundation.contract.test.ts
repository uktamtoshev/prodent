import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const migratedFiles = [
  "src/components/Header.tsx",
  "src/components/LanguageSwitcher.tsx",
  "src/components/shared/RoleSidebar.tsx",
  "src/components/shared/RoleCabinetShell.tsx",
  "src/components/market/MarketLayout.tsx",
  "src/components/seller/SellerLayout.tsx",
  "src/pages/Landing.tsx",
  "src/pages/Search.tsx",
  "src/pages/Clinics.tsx",
  "src/pages/seller/SellerProfile.tsx",
  "src/pages/technician/TechnicianProfile.tsx",
] as const;

const semanticThemeFiles = [
  "src/components/shared/RoleSidebar.tsx",
  "src/components/shared/RoleCabinetShell.tsx",
  "src/components/market/MarketLayout.tsx",
  "src/components/seller/SellerLayout.tsx",
  "src/pages/Search.tsx",
  "src/pages/Clinics.tsx",
  "src/pages/seller/SellerProfile.tsx",
] as const;

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("Sprint 1 UI foundation contract", () => {
  it.each(migratedFiles)("%s keeps product text at 12px or larger", (file) => {
    const source = readSource(file);
    const undersized = [...source.matchAll(/text-\[([0-9.]+)px\]/g)]
      .map((match) => Number(match[1]))
      .filter((size) => size < 12);

    expect(undersized, file).toEqual([]);
  });

  it.each(semanticThemeFiles)("%s uses semantic theme colors", (file) => {
    expect(readSource(file), file).not.toMatch(fixedPaletteClass);
  });

  it("keeps the migrated seller and technician profiles off the legacy design layer", () => {
    for (const file of [
      "src/pages/seller/SellerProfile.tsx",
      "src/pages/technician/TechnicianProfile.tsx",
    ]) {
      const source = readSource(file);
      expect(source, file).not.toContain('from "@/components/design"');
      expect(source, file).toContain('from "@/components/ui/card"');
    }
  });

  it("keeps public and cabinet mobile navigation targets at least 44px", () => {
    const header = readSource("src/components/Header.tsx");
    const roleSidebar = readSource("src/components/shared/RoleSidebar.tsx");
    const roleShell = readSource("src/components/shared/RoleCabinetShell.tsx");

    expect(header).toContain('className="h-11 w-11 md:hidden"');
    expect(header).not.toMatch(/\bmd:hidden h-(?:7|8|9|10) w-(?:7|8|9|10)\b/);
    expect(roleSidebar).toContain("h-11 w-11");
    expect(roleSidebar).toContain("roleSidebar.toggleNavigation");
    expect(roleShell).toContain("pt-16");
  });

  it("keeps public discovery actions readable and keyboard visible", () => {
    for (const file of ["src/pages/Search.tsx", "src/pages/Clinics.tsx"]) {
      const source = readSource(file);

      expect(source, file).toContain("focus-visible:ring-2");
      expect(source, file).toContain("h-11");
      expect(source, file).toContain("text-muted-foreground");
      expect(source, file).toContain("border-border");
    }
  });

  it("keeps public discovery controls functional and stateful", () => {
    const search = readSource("src/pages/Search.tsx");
    const clinics = readSource("src/pages/Clinics.tsx");

    expect(search).toContain("onSubmit={(event) =>");
    expect(search).toContain('aria-controls="search-filters"');
    expect(search).toContain("aria-expanded={mobileFiltersOpen}");
    expect(search).toContain('role="status" aria-live="polite" aria-busy="true"');
    expect(search).toContain('setShowMap(urlState.view === "map")');
    expect(search).not.toContain("success-emerald");

    expect(clinics).toContain('aria-controls="clinic-filters"');
    expect(clinics).toContain("aria-expanded={mobileFiltersOpen}");
    expect(clinics).toContain('role="status" aria-live="polite" aria-busy="true"');
    expect(clinics).not.toContain("onChange={() => undefined}");
    expect(clinics).not.toContain("success-emerald");
  });

  it("uses honest stable landing statistics without dash placeholders", () => {
    const landing = readSource("src/pages/Landing.tsx");

    expect(landing).toContain('status: "loading"');
    expect(landing).toContain("Promise.all");
    expect(landing).toContain('data-testid="public-live-stat-skeleton"');
    expect(landing).toContain('aria-busy={stats.status === "loading"}');
    expect(landing).not.toMatch(/doctors:\s*["']—["']/);
    expect(landing).not.toMatch(/clinics:\s*["']—["']/);
    expect(landing).not.toMatch(/rating:\s*["']—["']/);
  });
});
