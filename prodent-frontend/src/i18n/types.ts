export const SUPPORTED_LANGUAGES = ["ru", "uz", "uz_cyrl", "kz", "kg", "tj"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type TranslationDictionary = Record<string, unknown>;

export function isSupportedLanguage(value: string | null): value is Language {
  return value !== null && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
