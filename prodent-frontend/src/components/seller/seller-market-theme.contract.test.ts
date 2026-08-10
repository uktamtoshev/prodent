import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const scopedFiles = [
  "src/components/market/MarketLayout.tsx",
  "src/components/seller/SellerLayout.tsx",
  "src/pages/seller/SellerProfile.tsx",
];

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("seller and market semantic theme contract", () => {
  it.each(scopedFiles)("%s avoids fixed light/dark palette classes", (file) => {
    expect(source(file)).not.toMatch(fixedPaletteClass);
  });

  it("uses the maintained UI card instead of the legacy design layer", () => {
    const profile = source("src/pages/seller/SellerProfile.tsx");

    expect(profile).toContain('from "@/components/ui/card"');
    expect(profile).not.toContain('from "@/components/design"');
    expect(profile).not.toContain("<DesignCard");
  });

  it("keeps primary actions and compact navigation at least 44px tall", () => {
    const market = source("src/components/market/MarketLayout.tsx");
    const sellerLayout = source("src/components/seller/SellerLayout.tsx");
    const profile = source("src/pages/seller/SellerProfile.tsx");

    expect(market).not.toMatch(/\bh-9\b/);
    expect(sellerLayout).not.toMatch(/\b(?:h|w)-10\b/);
    expect(profile).not.toMatch(/\bh-10\b/);
  });
});
