import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { tGlobal } from "@/contexts/LanguageContext";
import { languageRuntime } from "@/i18n/language-runtime";
import { formatAmount } from "@/lib/localization";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency amount with proper thousand separators
 * @param amount - The amount to format
 * @param currency - Currency label (default: localized "сум")
 * @param showFree - Show "Бесплатно" (localized) for zero values (default: true)
 */
export function formatPrice(amount: number | null | undefined, currency?: string, showFree: boolean = true): string {
  if (amount === null || amount === undefined) return '—';
  const cur = currency ?? tGlobal('apiMessages.currencySum');
  if (amount === 0 && showFree) return tGlobal('apiMessages.priceFree');

  const formatted = formatAmount(amount, languageRuntime.getLanguage());

  return `${formatted} ${cur}`;
}

/**
 * Format currency for display with localized "от" prefix
 */
export function formatPriceFrom(amount: number | null | undefined, currency?: string): string {
  if (amount === null || amount === undefined) return '—';
  const cur = currency ?? tGlobal('apiMessages.currencySum');
  if (amount === 0) return tGlobal('apiMessages.priceFree');

  const formatted = formatAmount(amount, languageRuntime.getLanguage());

  return `${tGlobal('apiMessages.pricePrefixFrom')} ${formatted} ${cur}`;
}
