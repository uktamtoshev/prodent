import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const shellFiles = [
  "src/components/admin/AdminLayout.tsx",
  "src/components/admin/AdminSidebar.tsx",
  "src/components/lab/LabLayout.tsx",
  "src/components/sklad/SkladLayout.tsx",
  "src/components/sklad/SkladShared.tsx",
] as const;

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("admin, laboratory and warehouse Sprint 1 shell contract", () => {
  it.each(shellFiles)("%s keeps visible text at 12px or larger", (file) => {
    const source = readSource(file);
    const undersized = [...source.matchAll(/text-\[([0-9.]+)px\]/g)]
      .map((match) => Number(match[1]))
      .filter((size) => size < 12);

    expect(undersized, file).toEqual([]);
    expect(source, file).not.toMatch(/\btext-(?:2xs|3xs)\b/);
  });

  it.each(shellFiles)("%s uses semantic theme colors", (file) => {
    expect(readSource(file), file).not.toMatch(fixedPaletteClass);
  });

  it("keeps the admin content below the mobile toolbar", () => {
    const layout = readSource("src/components/admin/AdminLayout.tsx");

    expect(layout).toContain("pt-16");
    expect(layout).toContain("lg:pt-0");
    expect(layout).toContain("lg:pl-64");
    expect(layout).toContain("bg-background");
  });

  it.each([
    "src/components/lab/LabLayout.tsx",
    "src/components/sklad/SkladLayout.tsx",
  ])("%s provides keyboard state and 44px navigation targets", (file) => {
    const source = readSource(file);

    expect(source).toContain('aria-current={active ? "page" : undefined}');
    expect(source).toContain("h-11 min-w-11");
    expect(source).toContain("focus-visible:ring-2");
    expect(source).not.toMatch(/\binline-flex h-(?:8|9|10)\b/);
  });

  it("keeps warehouse dialog controls touch-friendly and mobile-safe", () => {
    const source = readSource("src/components/sklad/SkladShared.tsx");
    const compactControls =
      source.match(/<(?:Button|Input|SelectTrigger)\b[^>]*>/gs) ?? [];

    expect(compactControls.length).toBeGreaterThan(0);
    for (const control of compactControls) {
      expect(control, control).toContain("min-h-11");
    }
    expect(source).not.toMatch(/className="grid grid-cols-(?:2|3) gap-4"/);
    expect(source).toContain("grid grid-cols-1 gap-4 sm:grid-cols-2");
    expect(source).toContain("grid grid-cols-1 gap-4 sm:grid-cols-3");
  });
});
