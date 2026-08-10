// Canonical promotion-category taxonomy — the slugs stored in `promotions.category`.
// Single source of truth: the admin Promotions form writes these slugs and the public
// catalog filters + labels by them. This fixes the old mismatch where admin wrote EN
// slugs (whitening/cleaning/…) but the public page filtered by RU words (Гигиена/…),
// so admin-created promotions never matched any public category filter.
export const PROMO_CATEGORY_SLUGS = [
  'whitening',
  'cleaning',
  'implants',
  'braces',
  'prosthetics',
  'treatment',
  'extraction',
  'kids',
  'other',
] as const;

export type PromoCategorySlug = (typeof PROMO_CATEGORY_SLUGS)[number];

// i18n key for each slug's label (reuses the existing adminPromotions.cat* dictionary,
// so labels stay translated across all locales without a second taxonomy).
export const PROMO_CATEGORY_LABEL_KEY: Record<PromoCategorySlug, string> = {
  whitening: 'adminPromotions.catWhitening',
  cleaning: 'adminPromotions.catCleaning',
  implants: 'adminPromotions.catImplants',
  braces: 'adminPromotions.catBraces',
  prosthetics: 'adminPromotions.catProsthetics',
  treatment: 'adminPromotions.catTreatment',
  extraction: 'adminPromotions.catExtraction',
  kids: 'adminPromotions.catKids',
  other: 'adminPromotions.catOther',
};

// Translate a stored category slug via the provided `t`. Falls back to the raw value
// (covers any legacy rows that stored a non-slug string).
export function promoCategoryLabel(t: (k: string) => string, slug: string | null | undefined): string {
  if (!slug) return '';
  const key = PROMO_CATEGORY_LABEL_KEY[slug as PromoCategorySlug];
  return key ? t(key) : slug;
}
