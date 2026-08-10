import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { AVATAR_PALETTE, avatarSwatchFor, initialsFor } from "./avatar-palette";

/**
 * Machine-checked WCAG contrast for the avatar palette, the sibling of
 * src/design-tokens-contrast.contract.test.ts.
 *
 * Why this file exists: the palette shipped six background colours under a
 * hardcoded `text-white`, and three of them — teal at 2.77:1, amber at 2.72:1,
 * emerald at 3.07:1 — put unreadable initials in front of every patient list
 * in the product. A palette is just numbers, and contrast is arithmetic, so
 * assert it rather than eyeball it.
 */

/** `175 82% 26%` -> linear-light relative luminance per WCAG 2.x. */
function luminance(hsl: string): number {
  const match = hsl.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) throw new Error(`swatch is not a bare HSL triple: "${hsl}"`);
  const h = Number(match[1]);
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = l - c / 2;

  const lin = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

  return 0.2126 * lin(r1 + m) + 0.7152 * lin(g1 + m) + 0.0722 * lin(b1 + m);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe("avatar palette meets WCAG 2.2 AA", () => {
  it.each(AVATAR_PALETTE.map((s, i) => [i, s.fg, s.bg] as const))(
    "swatch %i: initials %s on %s reach 4.5:1",
    (_index, fg, bg) => {
      const ratio = contrast(fg, bg);
      expect(
        Number(ratio.toFixed(2)),
        `hsl(${fg}) on hsl(${bg}) = ${ratio.toFixed(2)}:1, needs >= 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("holds in both themes, because neither half is a theme token", () => {
    // The disc background is painted with an inline hsl() that no theme
    // overrides. If a foreground were a var(--token) it would flip with the
    // theme while its background stayed put, and the pair asserted above
    // would stop describing what is on screen in the dark theme.
    for (const { bg, fg } of AVATAR_PALETTE) {
      expect(bg).toMatch(/^[\d.]+ [\d.]+% [\d.]+%$/);
      expect(fg).toMatch(/^[\d.]+ [\d.]+% [\d.]+%$/);
    }
  });

  it("keeps the six swatches distinguishable by hue", () => {
    // Individually readable is not enough: a colour-per-name avatar is only
    // useful if two people in one list do not get the same-looking disc.
    const hues = AVATAR_PALETTE.map((s) => Number(s.bg.split(/\s+/)[0])).sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < hues.length; i += 1) {
      expect(
        hues[i] - hues[i - 1],
        `avatar hues ${hues[i - 1]} and ${hues[i]} are too close to tell apart`,
      ).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("the palette lives in exactly one place", () => {
  it("has no surviving copies outside the shared component", () => {
    // Eleven files had grown a byte-identical private copy of this palette
    // plus its Avatar, which is why one contrast bug needed eleven fixes.
    const root = resolve(process.cwd(), "src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (/\.tsx?$/.test(entry.name)) {
          const relative = path.slice(root.length).replace(/\\/g, "/");
          // The module that owns the palette, and this file, which names the
          // colour it is grepping for.
          if (relative.startsWith("/lib/avatar-palette")) continue;
          const source = readFileSync(path, "utf8");
          // The literal that every copy shared. Matching on the colour rather
          // than on `AVATAR_PALETTE` also catches a copy that renamed itself.
          if (source.includes('"175 70% 40%"')) offenders.push(relative);
        }
      }
    };
    walk(root);
    expect(offenders, "these files re-declare the avatar palette").toEqual([]);
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFor("Иван Иванов Иванович")).toBe("ИИ");
  });

  it("survives the double spaces that real full_name values carry", () => {
    expect(initialsFor("Иван  Иванов")).toBe("ИИ");
  });

  it("falls back when there is nothing to take an initial from", () => {
    expect(initialsFor("")).toBe("?");
    expect(initialsFor("", "D")).toBe("D");
  });
});

describe("swatch assignment", () => {
  it("is stable for a given name", () => {
    expect(avatarSwatchFor("Иван Иванов")).toBe(avatarSwatchFor("Иван Иванов"));
  });

  it("keeps the hash the inlined copies used, so no avatar changes colour", () => {
    for (const name of ["Иван Иванов", "Clinic Smile", "A", ""]) {
      const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
      expect(avatarSwatchFor(name)).toBe(
        AVATAR_PALETTE[hash % AVATAR_PALETTE.length],
      );
    }
  });
});
