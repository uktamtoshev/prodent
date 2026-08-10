export interface LanguageStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const LANGUAGE_STORAGE_KEY = "language";

function getBrowserStorage(): LanguageStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function safeGetStoredLanguage(
  storage: LanguageStorage | undefined = getBrowserStorage(),
): string | null {
  try {
    return storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function safeSetStoredLanguage(
  language: string,
  storage: LanguageStorage | undefined = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveStoredLanguage(
  storage: LanguageStorage | undefined = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(LANGUAGE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
