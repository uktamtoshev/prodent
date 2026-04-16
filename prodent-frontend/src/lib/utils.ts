import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency amount with proper thousand separators
 * @param amount - The amount to format
 * @param currency - Currency label (default: 'сум')
 * @param showFree - Show "Бесплатно" for zero values (default: true)
 */
export function formatPrice(amount: number | null | undefined, currency: string = 'сум', showFree: boolean = true): string {
  if (amount === null || amount === undefined) return '—';
  if (amount === 0 && showFree) return 'Бесплатно';
  
  // Format with spaces as thousand separators (Russian style)
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(amount);
  
  return `${formatted} ${currency}`;
}

/**
 * Format currency for display with "от" prefix
 */
export function formatPriceFrom(amount: number | null | undefined, currency: string = 'сум'): string {
  if (amount === null || amount === undefined) return '—';
  if (amount === 0) return 'Бесплатно';
  
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(amount);
  
  return `от ${formatted} ${currency}`;
}
