import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const shellFiles = [
  "src/components/seller/SellerLayout.tsx",
  "src/components/seller/SellerSidebar.tsx",
  "src/components/technician/TechnicianLayout.tsx",
  "src/components/technician/TechnicianOfflineBanner.tsx",
] as const;

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("seller and technician Sprint 1 shell contract", () => {
  it.each(shellFiles)("%s keeps product text at 12px or larger", (file) => {
    const undersized = [...source(file).matchAll(/text-\[([0-9.]+)px\]/g)]
      .map((match) => Number(match[1]))
      .filter((size) => size < 12);

    expect(undersized, file).toEqual([]);
  });

  it.each(shellFiles)("%s uses semantic theme colors", (file) => {
    expect(source(file), file).not.toMatch(fixedPaletteClass);
  });

  it("keeps both cabinet headers below the fixed mobile toolbar", () => {
    for (const file of [
      "src/components/seller/SellerLayout.tsx",
      "src/components/technician/TechnicianLayout.tsx",
    ]) {
      const layout = source(file);

      expect(layout, file).toContain("pt-16 lg:pl-64 lg:pt-0");
      expect(layout, file).toContain("top-16");
      expect(layout, file).toContain("lg:top-0");
    }
  });

  it("keeps mobile shell actions at least 44px and keyboard-visible", () => {
    const seller = source("src/components/seller/SellerLayout.tsx");
    const technician = source("src/components/technician/TechnicianLayout.tsx");

    expect(seller).toContain("h-11 w-11");
    expect(seller).toContain("focus-visible:ring-2");
    expect(technician).toContain('triggerClassName="h-11 w-11');
    expect(technician).toContain("focus-visible:ring-2");
  });

  it("exposes loading, search and offline states to assistive technology", () => {
    const seller = source("src/components/seller/SellerLayout.tsx");
    const technician = source("src/components/technician/TechnicianLayout.tsx");
    const offline = source("src/components/technician/TechnicianOfflineBanner.tsx");

    expect(seller).toContain('role="status"');
    expect(seller).toContain('aria-label={t("seller.searchPlaceholder")}');
    expect(seller).toContain('aria-label={t("notifications.menuLabel")}');
    expect(technician).toContain('aria-label={t("technician.searchPlaceholder")}');
    expect(offline).toContain('aria-live="polite"');
    expect(offline).toContain('aria-atomic="true"');
  });

  it("keeps the technician offline banner and header in one sticky stack", () => {
    const layout = source("src/components/technician/TechnicianLayout.tsx");
    const offline = source("src/components/technician/TechnicianOfflineBanner.tsx");

    expect(layout).toContain('className="sticky top-16 z-20 lg:top-0"');
    expect(offline).not.toMatch(/\bsticky\b/);
  });
});
