import type { Language } from "@/i18n/types";

export const LANGUAGE_LOCALES = {
  ru: "ru-RU",
  uz: "uz-Latn-UZ",
  uz_cyrl: "uz-Cyrl-UZ",
  kz: "kk-KZ",
  kg: "ky-KG",
  tj: "tg-TJ",
} as const satisfies Record<Language, string>;

export type CriticalTerm =
  | "visit"
  | "odontogram"
  | "treatmentPlan"
  | "payment"
  | "order";

export const CRITICAL_TERMS = {
  ru: {
    visit: "Визит",
    odontogram: "Одонтограмма",
    treatmentPlan: "План лечения",
    payment: "Оплата",
    order: "Заказ",
  },
  uz: {
    visit: "Tashrif",
    odontogram: "Odontogramma",
    treatmentPlan: "Davolash rejasi",
    payment: "Toʻlov",
    order: "Buyurtma",
  },
  uz_cyrl: {
    visit: "Ташриф",
    odontogram: "Одонтограмма",
    treatmentPlan: "Даволаш режаси",
    payment: "Тўлов",
    order: "Буюртма",
  },
  kz: {
    visit: "Келу",
    odontogram: "Одонтограмма",
    treatmentPlan: "Емдеу жоспары",
    payment: "Төлем",
    order: "Тапсырыс",
  },
  kg: {
    visit: "Келүү",
    odontogram: "Одонтограмма",
    treatmentPlan: "Дарылоо планы",
    payment: "Төлөм",
    order: "Буйрутма",
  },
  tj: {
    visit: "Ташриф",
    odontogram: "Одонтограмма",
    treatmentPlan: "Нақшаи табобат",
    payment: "Пардохт",
    order: "Фармоиш",
  },
} as const satisfies Record<Language, Record<CriticalTerm, string>>;

type DateValue = Date | string | number;
type DateFormatOptions = Intl.DateTimeFormatOptions;

export function localeFor(language: Language): string {
  return LANGUAGE_LOCALES[language];
}

function validDate(value: DateValue): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: DateValue,
  language: Language,
  options: DateFormatOptions = {},
): string {
  const date = validDate(value);
  if (!date) return "—";

  const hasExplicitDateShape = [
    "dateStyle",
    "weekday",
    "era",
    "year",
    "month",
    "day",
  ].some((key) => options[key as keyof DateFormatOptions] !== undefined);
  const resolvedOptions = hasExplicitDateShape
    ? options
    : {
        day: "2-digit" as const,
        month: "2-digit" as const,
        year: "numeric" as const,
        ...options,
      };

  return new Intl.DateTimeFormat(localeFor(language), resolvedOptions).format(date);
}

export function formatTime(
  value: DateValue,
  language: Language,
  options: DateFormatOptions = {},
): string {
  const date = validDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(localeFor(language), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...options,
  }).format(date);
}

export function formatAmount(value: number, language: Language): string {
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat(localeFor(language), {
    maximumFractionDigits: 2,
  }).format(value);
}

const DEFAULT_CALLING_CODES: Record<Language, string> = {
  ru: "998",
  uz: "998",
  uz_cyrl: "998",
  kz: "7",
  kg: "996",
  tj: "992",
};

export function formatPhone(value: string, language: Language): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";

  let digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    digits = `${DEFAULT_CALLING_CODES[language]}${digits}`;
  }

  if (/^998\d{9}$/.test(digits)) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }

  if (/^7\d{10}$/.test(digits)) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }

  if (/^996\d{9}$/.test(digits)) {
    return `+996 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }

  if (/^992\d{9}$/.test(digits)) {
    return `+992 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }

  return trimmed;
}
