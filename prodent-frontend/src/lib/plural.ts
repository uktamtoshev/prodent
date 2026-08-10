/**
 * Russian plural selection. Russian needs THREE forms, not two:
 *   1 врач · 2 врача · 5 врачей
 * Passing only singular/plural (the old `n === 1 ? a : b`) produces "1 врачей".
 *
 * Usage: pluralRu(n, ['врач', 'врача', 'врачей'])
 */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** Convenience: "5 врачей" (number + correct form). */
export function withCountRu(n: number, forms: [string, string, string]): string {
  return `${n} ${pluralRu(n, forms)}`;
}
