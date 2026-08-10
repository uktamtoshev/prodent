import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { languageRuntime } from "@/i18n/language-runtime";
import type { LanguageRuntime } from "@/i18n/language-runtime";
import type { LocaleNamespace } from "@/i18n/locale-loader";
import {
  safeGetStoredLanguage,
  safeRemoveStoredLanguage,
  safeSetStoredLanguage,
} from "@/i18n/language-storage";
import type { LanguageStorage } from "@/i18n/language-storage";
import { isSupportedLanguage } from "@/i18n/types";
import type { Language } from "@/i18n/types";
import { localeFor } from "@/lib/localization";

export type { Language } from "@/i18n/types";

export const languageNames: Record<Language, string> = {
  ru: "Русский",
  uz: "Oʻzbekcha",
  uz_cyrl: "Ўзбекча",
  kz: "Қазақша",
  kg: "Кыргызча",
  tj: "Тоҷикӣ",
};

export const languageFlags: Record<Language, string> = {
  ru: "🇷🇺",
  uz: "🇺🇿",
  uz_cyrl: "🇺🇿",
  kz: "🇰🇿",
  kg: "🇰🇬",
  tj: "🇹🇯",
};

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  ensureAppTranslations: (namespaces?: readonly LocaleNamespace[]) => Promise<void>;
  t: (key: string) => string;
}

// Deliberately NOT exported. Provider-free code (the design-system layer) uses
// `tGlobal` instead: exporting the context tempted primitives to read it
// directly, which broke every test that partially mocks this module with just
// `useLanguage`.
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

interface LanguageInitializationOptions {
  runtime?: Pick<LanguageRuntime, "getLanguage" | "switchLanguage">;
  storage?: LanguageStorage;
}

export function getInitialLanguage(storage?: LanguageStorage): Language {
  const saved = safeGetStoredLanguage(storage);

  if (isSupportedLanguage(saved)) return saved;

  if (saved) {
    // Remove legacy values such as "en" so country detection can run again.
    safeRemoveStoredLanguage(storage);
  }
  return "ru";
}

export async function initializeLanguage(
  language: Language = getInitialLanguage(),
  options: LanguageInitializationOptions = {},
): Promise<Language> {
  const runtime = options.runtime ?? languageRuntime;
  try {
    const committed = await runtime.switchLanguage(language);
    return committed ? language : runtime.getLanguage();
  } catch (error) {
    if (language === "ru") throw error;
    await runtime.switchLanguage("ru");

    // A broken saved locale must not be retried on every reload. Prefer
    // replacing it with Russian; if storage is full, at least remove it.
    if (safeGetStoredLanguage(options.storage) === language) {
      const replaced = safeSetStoredLanguage("ru", options.storage);
      if (!replaced) safeRemoveStoredLanguage(options.storage);
    }
    return "ru";
  }
}

export function tGlobal(key: string): string {
  return languageRuntime.translate(key);
}

function notifyLanguageError(): void {
  const title = tGlobal("common.error");
  const description = `${tGlobal("nav.language")}: ${title}`;
  void import("sonner")
    .then(({ toast }) => toast.error(title, { description }))
    .catch(() => undefined);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => languageRuntime.getLanguage());
  const [isReady, setIsReady] = useState(() => languageRuntime.isReady());
  const [, refreshTranslations] = useState(0);
  const manualChoiceRevision = useRef(0);
  const countryDetection = useRef<AbortController | null>(null);

  const activateLanguage = useCallback(
    async (
      nextLanguage: Language,
      persist: boolean,
      notifyFailure = false,
    ): Promise<boolean> => {
      try {
        const committed = await languageRuntime.switchLanguage(nextLanguage);
        if (!committed) return false;

        setLanguageState(nextLanguage);
        if (persist) {
          const persisted = safeSetStoredLanguage(nextLanguage);
          if (!persisted && notifyFailure) notifyLanguageError();
        }
        return true;
      } catch (error) {
        console.error(`Could not load locale "${nextLanguage}"`, error);
        if (notifyFailure) notifyLanguageError();
        return false;
      }
    },
    [],
  );

  const setLanguage = useCallback(
    (nextLanguage: Language) => {
      manualChoiceRevision.current += 1;
      countryDetection.current?.abort();
      void activateLanguage(nextLanguage, true, true);
    },
    [activateLanguage],
  );

  const ensureAppTranslations = useCallback(
    async (namespaces: readonly LocaleNamespace[] = ["app"]): Promise<void> => {
      await languageRuntime.loadNamespaces(namespaces);
      refreshTranslations((revision) => revision + 1);
    },
    [],
  );

  useEffect(() => {
    if (isReady) return;

    let active = true;
    void initializeLanguage().then((initializedLanguage) => {
      if (!active) return;
      setLanguageState(initializedLanguage);
      setIsReady(true);
    });

    return () => {
      active = false;
    };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || safeGetStoredLanguage()) return;

    let active = true;
    const initialManualChoiceRevision = manualChoiceRevision.current;
    const controller = new AbortController();
    countryDetection.current = controller;

    const detectCountryLanguage = async () => {
      let detectedLanguage: Language = "ru";
      try {
        const response = await fetch("https://ipapi.co/json/", { signal: controller.signal });
        const data = (await response.json()) as { country_code?: string };
        if (data.country_code === "UZ") detectedLanguage = "uz";
      } catch {
        if (controller.signal.aborted) return;
      }

      const manualChoiceWasMade =
        manualChoiceRevision.current !== initialManualChoiceRevision;
      if (
        active &&
        !controller.signal.aborted &&
        !manualChoiceWasMade &&
        !safeGetStoredLanguage()
      ) {
        await activateLanguage(detectedLanguage, true);
      }
    };

    void detectCountryLanguage();
    return () => {
      active = false;
      controller.abort();
      if (countryDetection.current === controller) countryDetection.current = null;
    };
  }, [activateLanguage, isReady]);

  useEffect(() => {
    if (isReady) document.documentElement.lang = localeFor(language);
  }, [isReady, language]);

  const value = useMemo<LanguageContextType>(
    () => ({ language, setLanguage, ensureAppTranslations, t: tGlobal }),
    [ensureAppTranslations, language, setLanguage],
  );

  if (!isReady) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
