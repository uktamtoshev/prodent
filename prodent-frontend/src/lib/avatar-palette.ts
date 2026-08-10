/**
 * The colour-per-name palette behind every initials avatar in the product.
 *
 * Why every swatch carries its own foreground: the palette used to be six
 * background colours painted under a hardcoded `text-white`, which measured
 * 2.77:1 (teal), 2.72:1 (amber) and 3.07:1 (emerald) against WCAG AA's 4.5:1 —
 * initials that were simply not readable. Darkening those three until they
 * passed with white would have turned the amber into a brown, so the
 * foreground follows the swatch's lightness instead: the three bright discs
 * take a near-black tint of their own hue, the three dark ones keep white.
 *
 * Both halves of a pair are literal colours, never theme tokens. The disc is
 * painted with an inline `hsl()` that does not follow the theme, so a token
 * foreground would flip to dark in the dark theme while its background stayed
 * put — that is exactly the bug `text-primary-foreground` had in
 * DoctorMedicalRecords.
 *
 * Ratios are asserted in `avatar-palette.contract.test.ts`. Add a swatch there
 * too, or the palette can silently regress again.
 */
export interface AvatarSwatch {
  /** Bare HSL triple painted as the disc background. */
  bg: string;
  /** Bare HSL triple for the initials; >= 4.5:1 against `bg`. */
  fg: string;
}

export const AVATAR_PALETTE: readonly AvatarSwatch[] = [
  { bg: "175 70% 40%", fg: "175 85% 10%" }, // teal    5.23:1
  { bg: "235 55% 50%", fg: "0 0% 100%" }, //   indigo  7.39:1
  { bg: "350 60% 50%", fg: "0 0% 100%" }, //   rose    5.06:1
  { bg: "40 80% 45%", fg: "40 90% 11%" }, //   amber   5.47:1
  { bg: "155 55% 42%", fg: "155 85% 9%" }, //  emerald 5.04:1
  { bg: "280 50% 50%", fg: "0 0% 100%" }, //   violet  5.59:1
];

/**
 * Which swatch a name gets. The hash is the one the inlined copies already
 * used, so nobody's avatar changes colour — only the text painted on it does.
 */
export function avatarSwatchFor(name: string): AvatarSwatch {
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function initialsFor(name: string, fallback = "?"): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || fallback
  );
}
