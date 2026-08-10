import { LocaleLoader, localeLoader } from "./locale-loader";
import type { LocaleNamespace } from "./locale-loader";
import {
  cloneTranslationDictionary,
  mergeTranslationDictionaries,
} from "./translation-contracts";
import type { Language, TranslationDictionary } from "./types";

interface LookupResult {
  found: boolean;
  value?: unknown;
}

function lookup(dictionary: TranslationDictionary, key: string): LookupResult {
  let value: unknown = dictionary;

  for (const part of key.split(".")) {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      !(part in value)
    ) {
      return { found: false };
    }
    value = (value as TranslationDictionary)[part];
  }

  return { found: true, value };
}

export class LanguageRuntime {
  private language: Language = "ru";
  private dictionary: TranslationDictionary | undefined;
  private russianFallback: TranslationDictionary | undefined;
  private readonly loadedNamespaces = new Map<Language, Set<LocaleNamespace>>();
  private latestRequest = 0;

  constructor(private readonly loader: LocaleLoader = localeLoader) {}

  getLanguage(): Language {
    return this.language;
  }

  isReady(): boolean {
    return this.dictionary !== undefined && this.russianFallback !== undefined;
  }

  async switchLanguage(language: Language): Promise<boolean> {
    const requestId = ++this.latestRequest;

    try {
      const russianPromise = this.loader.load("ru");
      const dictionaryPromise = language === "ru" ? russianPromise : this.loader.load(language);
      const [russianFallback, dictionary] = await Promise.all([
        russianPromise,
        dictionaryPromise,
      ]);

      if (requestId !== this.latestRequest) return false;

      const russianDictionary = cloneTranslationDictionary(russianFallback);
      this.russianFallback = russianDictionary;
      this.dictionary =
        language === "ru"
          ? russianDictionary
          : cloneTranslationDictionary(dictionary);
      this.loadedNamespaces.set("ru", new Set(["base"]));
      this.loadedNamespaces.set(language, new Set(["base"]));
      this.language = language;
      return true;
    } catch (error) {
      if (requestId !== this.latestRequest) return false;
      throw error;
    }
  }

  async loadNamespace(namespace: LocaleNamespace): Promise<void> {
    if (namespace === "base" || this.isNamespaceLoaded(this.language, namespace)) return;
    if (!this.dictionary || !this.russianFallback) {
      await this.switchLanguage(this.language);
    }

    const language = this.language;
    const russianPromise = this.isNamespaceLoaded("ru", namespace)
      ? Promise.resolve(undefined)
      : this.loader.load("ru", namespace);
    const dictionaryPromise = language === "ru"
      ? russianPromise
      : this.loader.load(language, namespace);
    const [russianNamespace, dictionaryNamespace] = await Promise.all([
      russianPromise,
      dictionaryPromise,
    ]);

    if (this.language !== language || !this.dictionary || !this.russianFallback) return;

    if (russianNamespace) {
      mergeTranslationDictionaries(
        this.russianFallback,
        russianNamespace,
        namespace,
      );
      this.markNamespaceLoaded("ru", namespace);
    }

    if (language !== "ru" && dictionaryNamespace) {
      mergeTranslationDictionaries(
        this.dictionary,
        dictionaryNamespace,
        namespace,
      );
    }
    this.markNamespaceLoaded(language, namespace);
  }

  async loadNamespaces(namespaces: readonly LocaleNamespace[]): Promise<void> {
    await Promise.all(namespaces.map((namespace) => this.loadNamespace(namespace)));
  }

  private isNamespaceLoaded(language: Language, namespace: LocaleNamespace): boolean {
    return this.loadedNamespaces.get(language)?.has(namespace) ?? false;
  }

  private markNamespaceLoaded(language: Language, namespace: LocaleNamespace): void {
    const namespaces = this.loadedNamespaces.get(language) ?? new Set<LocaleNamespace>();
    namespaces.add(namespace);
    this.loadedNamespaces.set(language, namespaces);
  }

  translate(key: string): string {
    if (!this.dictionary || !this.russianFallback) return key;

    const translated = lookup(this.dictionary, key);
    if (translated.found) {
      return typeof translated.value === "string" ? translated.value : key;
    }

    const fallback = lookup(this.russianFallback, key);
    return fallback.found && typeof fallback.value === "string" ? fallback.value : key;
  }
}

export const languageRuntime = new LanguageRuntime();
