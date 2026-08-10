#!/usr/bin/env node
/**
 * Migrate a cabinet file from hardcoded Tailwind palette classes to the
 * project's semantic tokens.
 *
 * Why: the CRM/doctor cabinets carried ~1550 palette classes across 90 files.
 * They were written against a white card, so the whole clinical surface went
 * unreadable the moment a doctor hit the theme toggle (text-slate-900 on a dark
 * --card measures about 1:1). Colour also stopped meaning anything: "green" was
 * emerald-500, emerald-600, green-500, green-600 and #047857 at once.
 *
 * What this handles (mechanical, safe):
 *   - light-only surfaces and text -> semantic pairs
 *   - arbitrary radii -> radius tokens
 *   - arbitrary font sizes -> the type scale (and flags anything under 12px)
 *
 * What it deliberately does NOT do: decide what a colour MEANS. Status chips
 * (paid / cancelled / no-show / caries) must be mapped to `status-*` or
 * `tooth-*` tokens by a human, because only a human knows whether an amber chip
 * is a warning or a decoration. Those are reported as leftovers instead.
 *
 * Usage:
 *   node scripts/codemod-semantic-tokens.mjs --dry-run src/pages/doctor/X.tsx
 *   node scripts/codemod-semantic-tokens.mjs src/pages/doctor/X.tsx ...
 */

import { readFileSync, writeFileSync } from "node:fs";

/** Purely structural: no semantic judgement needed. */
const MECHANICAL = [
  // Surfaces and text. slate-700 and darker is body text; 600 and lighter is
  // secondary text. Both collapse onto the two semantic text tokens.
  [/\btext-(?:slate|gray|zinc)-(?:950|900|800|700)\b/g, "text-foreground"],
  [/\btext-(?:slate|gray|zinc)-(?:600|500|400)\b/g, "text-muted-foreground"],
  [/\bbg-(?:slate|gray|zinc)-50\/60\b/g, "bg-muted/50"],
  [/\bbg-(?:slate|gray|zinc)-50\b/g, "bg-muted/50"],
  [/\bbg-(?:slate|gray|zinc)-(?:100|200)\b/g, "bg-muted"],
  [/\bborder-(?:slate|gray|zinc)-\d{2,3}(?:\/\d+)?\b/g, "border-border"],
  [/\bdivide-(?:slate|gray|zinc)-\d{2,3}\b/g, "divide-border"],
  [/\bring-(?:slate|gray|zinc)-\d{2,3}\b/g, "ring-border"],
  [/\bbg-white\b/g, "bg-card"],
  [/\bplaceholder-(?:slate|gray|zinc)-\d{2,3}\b/g, "placeholder:text-muted-foreground"],

  // Brand escape hatches that predate the tokens.
  [/bg-\[hsl\(var\(--brand\)\)\]/g, "bg-primary"],
  [/bg-\[hsl\(var\(--brand-50\)\)\]/g, "bg-primary/10"],
  [/text-\[hsl\(var\(--brand-700\)\)\]/g, "text-primary"],
  [/text-\[hsl\(var\(--brand\)\)\]/g, "text-primary"],

  // Radii -> tokens (cards 14, buttons 12, inputs 10).
  [/\brounded-\[14px\]/g, "rounded-prodent"],
  [/\brounded-\[12px\]/g, "rounded-prodent-btn"],
  [/\brounded-\[10px\]/g, "rounded-prodent-input"],

  // Type scale. 12px is the documented floor for product text.
  [/\btext-\[(?:32|30)px\]/g, "text-3xl"],
  [/\btext-\[(?:28|26|24)px\]/g, "text-2xl"],
  [/\btext-\[(?:22|20|19)px\]/g, "text-xl"],
  [/\btext-\[(?:18|17|16)px\]/g, "text-lg"],
  [/\btext-\[(?:15|14)px\]/g, "text-base"],
  [/\btext-\[13(?:\.5)?px\]/g, "text-sm"],
  [/\btext-\[(?:12|12\.5|11|11\.5|10|10\.5|9)px\]/g, "text-xs"],
];

/**
 * Colours that encode meaning. Reported, never auto-replaced — mapping them
 * requires knowing what the chip says.
 */
const SEMANTIC_HUES =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide)-(?:blue|emerald|amber|red|green|violet|cyan|indigo|rose|orange|purple|teal|sky|yellow|pink|lime|fuchsia)-\d{2,3}(?:\/\d+)?\b/g;

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/g;
const INLINE_STYLE = /style=\{\{/g;
const TINY_TEXT = /\btext-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/g;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const files = args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("usage: codemod-semantic-tokens.mjs [--dry-run] <file...>");
  process.exit(1);
}

let totalChanged = 0;
let totalLeftovers = 0;

for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before;
  let replacements = 0;

  for (const [pattern, token] of MECHANICAL) {
    after = after.replace(pattern, () => {
      replacements += 1;
      return token;
    });
  }

  const count = (source, pattern) => (source.match(pattern) ?? []).length;
  const leftovers = {
    "semantic hues (map to status-*/tooth-* by hand)": count(after, SEMANTIC_HUES),
    "hex literals": count(after, HEX_LITERAL),
    "inline style={{}}": count(after, INLINE_STYLE),
    "text below 12px": count(after, TINY_TEXT),
  };
  const leftoverTotal = Object.values(leftovers).reduce((a, b) => a + b, 0);

  console.log(
    `${file}\n  ${replacements} mechanical replacement(s)` +
      (leftoverTotal
        ? `\n  needs a human:\n` +
          Object.entries(leftovers)
            .filter(([, n]) => n > 0)
            .map(([label, n]) => `    ${n} x ${label}`)
            .join("\n")
        : `\n  clean`),
  );

  if (!dryRun && after !== before) writeFileSync(file, after);
  totalChanged += replacements;
  totalLeftovers += leftoverTotal;
}

console.log(
  `\n${dryRun ? "[dry run] " : ""}${totalChanged} replacement(s) across ${files.length} file(s); ${totalLeftovers} item(s) still need a human decision.`,
);
