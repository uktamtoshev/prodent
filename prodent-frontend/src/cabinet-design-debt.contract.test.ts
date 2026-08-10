import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A ratchet for the CRM/doctor cabinet's visual debt.
 *
 * The cabinet is mid-migration onto semantic tokens, so a flat "zero
 * occurrences" gate would fail on day one and get switched off. Instead each
 * pattern carries a CEILING equal to what is left today. Adding one is a
 * failure; removing them lowers the ceiling. That is what keeps a 900-item
 * cleanup from silently refilling while it is being done.
 *
 * When you reduce a number, LOWER THE CEILING in the same commit. When a
 * ceiling reaches 0, replace it with a hard ban.
 *
 * Why these specific patterns, in one place:
 *  - palette classes are written against one theme, so the clinical screens went
 *    unreadable the moment a doctor pressed the theme toggle;
 *  - raw hex bypasses the theme entirely (the tooth chart measured 1.79:1);
 *  - text under 12px is banned by the project's own typography guide;
 *  - window.confirm cannot be themed or translated and is silently suppressible
 *    on some mobile browsers, where it returns false and the click does nothing;
 *  - inline fontFamily/boxShadow duplicate utilities that already exist.
 */

const CABINET_DIRS = [
  "src/pages/crm",
  "src/pages/doctor",
  "src/components/crm",
  "src/components/doctor",
];

/** Ceilings measured 2026-07-31. Lower them, never raise them. */
const CEILINGS = {
  /**
   * 939 -> 298. What is left is deliberate, not unfinished: 246 of these sit in
   * files nothing imports (ops/crm-dead-code-inventory.md) and go away with that
   * deletion, and the rest are CATEGORICAL palettes — patient tag colours, the
   * nine role hues, hash-picked avatar colours — where flattening the hues onto
   * status tokens would make two different things look identical. Those already
   * carry explicit `dark:` variants, so they are not a dark-theme bug.
   */
  palette: 298,
  bgWhite: 0,
  hexLiteral: 204,
  tinyText: 0,
  nativeConfirm: 1,
  inlineFontFamily: 1,
  inlineBoxShadow: 7,
  arbitrarySize: 232,
} as const;

const PATTERNS: Record<keyof typeof CEILINGS, RegExp> = {
  palette:
    /\b(?:bg|text|border|ring|divide|from|to|via|fill|stroke|placeholder)-(?:slate|gray|zinc|neutral|stone|blue|emerald|amber|red|green|violet|cyan|indigo|rose|orange|purple|teal|sky|yellow|pink|lime|fuchsia)-[0-9]{2,3}\b/g,
  bgWhite: /\bbg-white\b/g,
  hexLiteral: /#[0-9a-fA-F]{6}\b/g,
  tinyText: /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/g,
  nativeConfirm: /window\.confirm\(/g,
  inlineFontFamily: /fontFamily:/g,
  inlineBoxShadow: /boxShadow:/g,
  arbitrarySize: /\[[0-9]+(?:\.[0-9]+)?(?:px|rem)\]/g,
};

/** Comments explaining what a colour USED to be must not count as debt. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[^\n]*?\/\/.*$/gm, "");
}

function collectFiles(dir: string): string[] {
  const root = resolve(process.cwd(), dir);
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".tsx")) continue;
      if (entry.includes(".test.")) continue;
      out.push(full);
    }
  };
  walk(root);
  return out;
}

const FILES = CABINET_DIRS.flatMap(collectFiles);

function countAll(pattern: RegExp): { total: number; worst: Array<[string, number]> } {
  const perFile = new Map<string, number>();
  let total = 0;
  for (const file of FILES) {
    const source = stripComments(readFileSync(file, "utf8"));
    const hits = source.match(new RegExp(pattern.source, "g"))?.length ?? 0;
    if (hits) {
      perFile.set(file, hits);
      total += hits;
    }
  }
  const worst = [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { total, worst };
}

describe("cabinet visual debt does not grow", () => {
  it("finds the cabinet source files", () => {
    // Guard against the walker silently matching nothing and the whole suite
    // passing for the wrong reason.
    expect(FILES.length).toBeGreaterThan(150);
  });

  for (const key of Object.keys(CEILINGS) as Array<keyof typeof CEILINGS>) {
    it(`keeps ${key} at or below ${CEILINGS[key]}`, () => {
      const { total, worst } = countAll(PATTERNS[key]);
      const hint = worst
        .map(([file, n]) => `${n}x ${file.split("src")[1]}`)
        .join(", ");
      expect(
        total,
        `${key}: ${total} found, ceiling ${CEILINGS[key]}. Worst: ${hint || "none"}. ` +
          `If you REDUCED this, lower the ceiling in this file.`,
      ).toBeLessThanOrEqual(CEILINGS[key]);
    });
  }
});

describe("hard bans in the cabinet", () => {
  it("never reintroduces bg-white", () => {
    // Reached zero, so it is a ban now: bg-white on a dark theme card is the
    // single most common way the clinical screens broke.
    expect(countAll(PATTERNS.bgWhite).total).toBe(0);
  });

  it("never reintroduces text below 12px", () => {
    expect(countAll(PATTERNS.tinyText).total).toBe(0);
  });
});
