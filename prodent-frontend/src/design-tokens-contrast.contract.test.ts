import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Machine-checked WCAG contrast for the semantic colour tokens.
 *
 * Why this file exists: the CRM/doctor audit found that the single most
 * important navigation state in the product — the active sidebar item — was
 * white-on-sky-500 at 2.85:1, and that `--accent` (the surface every Radix
 * menu paints its hovered row with) held a dark teal, making the hovered
 * option the hardest one to read at 2.31:1. Both were invisible to code review
 * because a token is just three numbers. Contrast is arithmetic, so assert it.
 *
 * Any token pair a human is expected to READ belongs in one of the tables
 * below. Adding a colour token without adding it here is how the regression
 * comes back.
 */

const CSS = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/** Pull an `--x: H S% L%;` triple out of the `:root` or `.dark` block. */
function tokenBlock(selector: ":root" | ".dark"): Record<string, string> {
  // Both blocks live inside `@layer base`, so match up to the first line that
  // closes the block at the same indentation.
  const start = CSS.indexOf(`${selector} {`);
  expect(start, `${selector} block must exist in index.css`).toBeGreaterThan(-1);
  const body = CSS.slice(start, CSS.indexOf("\n  }", start));
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

const LIGHT = tokenBlock(":root");
const DARK = tokenBlock(".dark");

/** `175 82% 26%` -> linear-light relative luminance per WCAG 2.x. */
function luminance(hsl: string): number {
  const match = hsl.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) throw new Error(`token is not a bare HSL triple: "${hsl}"`);
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

  return (
    0.2126 * lin(r1 + m) + 0.7152 * lin(g1 + m) + 0.0722 * lin(b1 + m)
  );
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Foreground/background token pairs a user must be able to read. */
const READABLE_PAIRS: Array<[fg: string, bg: string, label: string]> = [
  ["--foreground", "--background", "body text on page"],
  ["--card-foreground", "--card", "text on card"],
  ["--muted-foreground", "--background", "helper text on page"],
  ["--muted-foreground", "--card", "helper text on card"],
  // Шапка таблицы: приглушённый текст на второй поверхности внутри карточки.
  ["--muted-foreground", "--surface-2", "table header on its own surface"],
  ["--foreground", "--surface-2", "text on the second surface"],
  ["--popover-foreground", "--popover", "text in popover"],
  ["--primary-foreground", "--primary", "label on primary button"],
  ["--secondary-foreground", "--secondary", "label on secondary button"],
  ["--destructive-foreground", "--destructive", "label on destructive button"],
  // The two blockers this suite was written for:
  ["--accent-foreground", "--accent", "hovered row in every Radix menu"],
  ["--sidebar-text", "--sidebar-item-active", "ACTIVE sidebar item"],
  ["--sidebar-text", "--sidebar-bg", "sidebar item"],
  ["--sidebar-text-muted", "--sidebar-bg", "sidebar section header"],
  ["--sidebar-text", "--sidebar-item-hover", "hovered sidebar item"],
  // Status semantics — each -fg is only ever painted on its own -bg.
  ["--status-success", "--status-success-bg", "success chip"],
  ["--status-warning", "--status-warning-bg", "warning chip"],
  ["--status-danger", "--status-danger-bg", "danger chip"],
  ["--status-info", "--status-info-bg", "info chip"],
  ["--status-neutral", "--status-neutral-bg", "neutral chip"],
  // Tooth chart — the FDI number must be readable on every tile, in both
  // themes. This is the pair that measured 1.44:1 before the redesign.
  ["--tooth-healthy", "--tooth-healthy-bg", "healthy tooth number"],
  ["--tooth-caries", "--tooth-caries-bg", "caries tooth number"],
  ["--tooth-filling", "--tooth-filling-bg", "filled tooth number"],
  ["--tooth-crown", "--tooth-crown-bg", "crowned tooth number"],
  ["--tooth-implant", "--tooth-implant-bg", "implant tooth number"],
  ["--tooth-removed", "--tooth-removed-bg", "removed tooth number"],
  ["--tooth-watch", "--tooth-watch-bg", "watched tooth number"],
  ["--tooth-endo", "--tooth-endo-bg", "endo tooth number"],
  ["--tooth-perio", "--tooth-perio-bg", "periodontitis tooth number"],
];

/**
 * Tooth states must stay tellable apart, not just individually readable — a
 * dentist scans 32 tiles at once. `implant` and `removed` are deliberately
 * excluded: they are the two desaturated greys, identified by having no hue
 * rather than by which hue they have.
 */
const TOOTH_HUES = [
  "--tooth-healthy",
  "--tooth-watch",
  "--tooth-caries",
  "--tooth-perio",
  "--tooth-endo",
  "--tooth-filling",
  "--tooth-crown",
];

describe("semantic colour tokens meet WCAG 2.2 AA", () => {
  for (const [theme, tokens] of [
    ["light", LIGHT],
    ["dark", DARK],
  ] as const) {
    describe(`${theme} theme`, () => {
      it.each(READABLE_PAIRS)(
        "%s on %s (%s) reaches 4.5:1",
        (fg, bg, _label) => {
          // The dark block only overrides a subset; anything it does not
          // redefine is inherited from :root and already covered there.
          if (theme === "dark" && (!tokens[fg] || !tokens[bg])) return;
          expect(tokens[fg], `${fg} missing in ${theme}`).toBeDefined();
          expect(tokens[bg], `${bg} missing in ${theme}`).toBeDefined();

          const ratio = contrast(tokens[fg], tokens[bg]);
          expect(
            Number(ratio.toFixed(2)),
            `${fg} on ${bg} = ${ratio.toFixed(2)}:1, needs >= 4.5:1`,
          ).toBeGreaterThanOrEqual(4.5);
        },
      );
    });
  }
});

describe("token semantics that a contrast check alone cannot catch", () => {
  it("keeps --accent a QUIET surface, not a solid brand colour", () => {
    // Radix paints hovered/selected menu rows with `bg-accent`. A saturated,
    // dark value there inverts the reading order: the row under the cursor
    // becomes the least legible one. Light theme => light surface.
    const lightness = Number(LIGHT["--accent"].match(/([\d.]+)%\s*$/)![1]);
    expect(
      lightness,
      `--accent is ${LIGHT["--accent"]}; a hover surface must stay light in the light theme`,
    ).toBeGreaterThanOrEqual(85);
  });

  it("keeps the sidebar in the brand hue family (one brand per screen)", () => {
    // The sidebar used to be navy (222deg) with a sky-500 accent (199deg)
    // while all content was teal (175deg) — two unrelated brands on one
    // screen. Keep chrome and brand within one hue neighbourhood.
    const hue = (token: string) => Number(token.split(/\s+/)[0]);
    const brand = hue(LIGHT["--primary"]);
    for (const token of ["--sidebar-bg", "--sidebar-item-active", "--sidebar-accent"]) {
      expect(
        Math.abs(hue(LIGHT[token]) - brand),
        `${token} hue ${hue(LIGHT[token])} is far from brand hue ${brand}`,
      ).toBeLessThanOrEqual(30);
    }
  });

  it("keeps the nine tooth states distinguishable by hue", () => {
    // Individually readable is not enough: a dentist scans 32 tiles at once,
    // so two states 10 degrees apart read as the same state. Colour is backed
    // by a letter code in the component, but the hues must still separate.
    const hues = TOOTH_HUES.map((t) => Number(LIGHT[t].split(/\s+/)[0])).sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < hues.length; i += 1) {
      expect(
        hues[i] - hues[i - 1],
        `tooth hues ${hues[i - 1]} and ${hues[i]} are too close to tell apart`,
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it("does not point the mono font stack at a proportional font", () => {
    const config = readFileSync(resolve(process.cwd(), "tailwind.config.ts"), "utf8");
    const mono = config.match(/mono:\s*\[([^\]]+)\]/)![1];
    // "IBM Plex Sans" is proportional; naming it under `mono` silently broke
    // every numeric column that asked for monospaced digits.
    expect(mono).not.toMatch(/Plex Sans|Inter|Manrope|Tajawal/);
    expect(mono).toMatch(/monospace/);
  });
});
