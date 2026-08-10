import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const sources = {
  landing: readSource("src/pages/Landing.tsx"),
  header: readSource("src/components/Header.tsx"),
  footer: readSource("src/components/Footer.tsx"),
  language: readSource("src/components/LanguageSwitcher.tsx"),
};

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("Sprint 1 public shell UI contracts", () => {
  it.each(Object.entries(sources))("%s keeps readable text and theme-aware colors", (_name, source) => {
    expect(source).not.toMatch(/text-\[(?:8|9|10|11)(?:\.\d+)?px\]/);
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(fixedPaletteClass);
  });

  it("does not render nested interactive Link and Button controls", () => {
    for (const source of [sources.landing, sources.header]) {
      expect(source).not.toMatch(/<Link\b[^>]*>\s*<Button\b/);
    }

    expect(sources.landing.match(/<Button\s+asChild/g)?.length).toBeGreaterThanOrEqual(6);
    expect(sources.header).toMatch(/<Button\s+asChild/);
  });

  it("keeps landing and header navigation targets at least 44px", () => {
    expect(sources.landing).toContain(
      "[&_[role=menuitem]]:min-h-11",
    );
    expect(sources.landing).toContain('className="h-11 w-11 md:hidden"');
    expect(sources.landing).toContain("min-h-16 h-auto");

    expect(sources.header).toContain("flex h-11 items-center rounded-full");
    expect(sources.header).toContain(
      "[&_[role=menuitem]]:min-h-11",
    );
    expect(sources.header).toContain(
      "flex min-h-11 min-w-11 items-center justify-between",
    );
    expect(sources.header).toContain("focus-visible:ring-2");
  });

  it("keeps footer and language actions compact, reachable, and keyboard visible", () => {
    expect(sources.footer).toContain("flex h-11 w-11 items-center");
    expect(
      sources.footer.match(/inline-flex min-h-11 min-w-11 items-center/g)?.length,
    ).toBeGreaterThanOrEqual(12);
    expect(sources.footer).toContain("focus-visible:ring-2");

    expect(sources.language).toContain("min-h-11 min-w-11");
    expect(sources.language).toContain("className={`min-h-11");
    expect(sources.language).toContain("aria-current={language === lang");
  });
});
