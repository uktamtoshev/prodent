import type { Language, TranslationDictionary } from "./types";

export type LocaleNamespace =
  | "base"
  | "shared"
  | "crm"
  | "crm-core"
  | "crm-schedule"
  | "crm-patients"
  | "crm-finance"
  | "crm-treatment"
  | "crm-settings"
  | "crm-ops"
  | "doctor"
  | "doctor-core"
  | "doctor-schedule"
  | "doctor-patients"
  | "doctor-treatment"
  | "doctor-finance"
  | "doctor-ops"
  | "doctor-profile"
  | "doctor-communication"
  | "doctor-market"
  | "patient"
  | "patient-core"
  | "patient-dashboard"
  | "patient-appointments"
  | "patient-doctors"
  | "patient-family"
  | "patient-communication"
  | "patient-finance"
  | "patient-files"
  | "patient-history"
  | "patient-access"
  | "patient-book"
  | "patient-medical"
  | "admin"
  | "commerce"
  | "ops"
  | "app";

export interface LocaleModule {
  default: TranslationDictionary;
}

export type LocaleImporter = () => Promise<LocaleModule>;
export type LocaleImporters = Record<Language, LocaleImporter>;
export type LocaleNamespaceImporters = Partial<Record<LocaleNamespace, LocaleImporters>> & {
  base: LocaleImporters;
};

export const localeImporters: LocaleNamespaceImporters = {
  base: {
    ru: () => import("./locales/ru.base"),
    uz: () => import("./locales/uz.base"),
    uz_cyrl: () => import("./locales/uz_cyrl.base"),
    kz: () => import("./locales/kz.base"),
    kg: () => import("./locales/kg.base"),
    tj: () => import("./locales/tj.base"),
  },
  app: {
    ru: () => import("./locales/ru.app"),
    uz: () => import("./locales/uz.app"),
    uz_cyrl: () => import("./locales/uz_cyrl.app"),
    kz: () => import("./locales/kz.app"),
    kg: () => import("./locales/kg.app"),
    tj: () => import("./locales/tj.app"),
  },
  shared: {
    ru: () => import("./locales/ru.shared"),
    uz: () => import("./locales/uz.shared"),
    uz_cyrl: () => import("./locales/uz_cyrl.shared"),
    kz: () => import("./locales/kz.shared"),
    kg: () => import("./locales/kg.shared"),
    tj: () => import("./locales/tj.shared"),
  },
  crm: {
    ru: () => import("./locales/ru.crm"),
    uz: () => import("./locales/uz.crm"),
    uz_cyrl: () => import("./locales/uz_cyrl.crm"),
    kz: () => import("./locales/kz.crm"),
    kg: () => import("./locales/kg.crm"),
    tj: () => import("./locales/tj.crm"),
  },
  "crm-core": {
    ru: () => import("./locales/ru.crm-core"),
    uz: () => import("./locales/uz.crm-core"),
    uz_cyrl: () => import("./locales/uz_cyrl.crm-core"),
    kz: () => import("./locales/kz.crm-core"),
    kg: () => import("./locales/kg.crm-core"),
    tj: () => import("./locales/tj.crm-core"),
  },
  "crm-schedule": {
    ru: () => import("./locales/ru.crm-schedule"),
    uz: () => import("./locales/uz.crm-schedule"),
    uz_cyrl: () => import("./locales/uz_cyrl.crm-schedule"),
    kz: () => import("./locales/kz.crm-schedule"),
    kg: () => import("./locales/kg.crm-schedule"),
    tj: () => import("./locales/tj.crm-schedule"),
  },
  "crm-patients": {
    ru: () => import("./locales/ru.crm-patients"),
    uz: () => import("./locales/uz.crm-patients"),
    uz_cyrl: () => import("./locales/uz_cyrl.crm-patients"),
    kz: () => import("./locales/kz.crm-patients"),
    kg: () => import("./locales/kg.crm-patients"),
    tj: () => import("./locales/tj.crm-patients"),
  },
  "crm-finance": {
    ru: () => import("./locales/ru.crm-finance"),
    uz: () => import("./locales/uz.crm-finance"),
    uz_cyrl: () => import("./locales/uz_cyrl.crm-finance"),
    kz: () => import("./locales/kz.crm-finance"),
    kg: () => import("./locales/kg.crm-finance"),
    tj: () => import("./locales/tj.crm-finance"),
  },
  "crm-treatment": {
    ru: () => import("./locales/ru.crm-treatment"),
    uz: () => import("./locales/uz.crm-treatment"),
    uz_cyrl: () => import("./locales/uz_cyrl.crm-treatment"),
    kz: () => import("./locales/kz.crm-treatment"),
    kg: () => import("./locales/kg.crm-treatment"),
    tj: () => import("./locales/tj.crm-treatment"),
  },
  "crm-settings": {
    ru: () => import("./locales/ru.crm-settings"),
    uz: () => import("./locales/uz.crm-settings"),
    uz_cyrl: () => import("./locales/uz_cyrl.crm-settings"),
    kz: () => import("./locales/kz.crm-settings"),
    kg: () => import("./locales/kg.crm-settings"),
    tj: () => import("./locales/tj.crm-settings"),
  },
  "crm-ops": {
    ru: () => import("./locales/ru.crm-ops"),
    uz: () => import("./locales/uz.crm-ops"),
    uz_cyrl: () => import("./locales/uz_cyrl.crm-ops"),
    kz: () => import("./locales/kz.crm-ops"),
    kg: () => import("./locales/kg.crm-ops"),
    tj: () => import("./locales/tj.crm-ops"),
  },
  doctor: {
    ru: () => import("./locales/ru.doctor"),
    uz: () => import("./locales/uz.doctor"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor"),
    kz: () => import("./locales/kz.doctor"),
    kg: () => import("./locales/kg.doctor"),
    tj: () => import("./locales/tj.doctor"),
  },
  "doctor-core": {
    ru: () => import("./locales/ru.doctor-core"),
    uz: () => import("./locales/uz.doctor-core"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-core"),
    kz: () => import("./locales/kz.doctor-core"),
    kg: () => import("./locales/kg.doctor-core"),
    tj: () => import("./locales/tj.doctor-core"),
  },
  "doctor-schedule": {
    ru: () => import("./locales/ru.doctor-schedule"),
    uz: () => import("./locales/uz.doctor-schedule"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-schedule"),
    kz: () => import("./locales/kz.doctor-schedule"),
    kg: () => import("./locales/kg.doctor-schedule"),
    tj: () => import("./locales/tj.doctor-schedule"),
  },
  "doctor-patients": {
    ru: () => import("./locales/ru.doctor-patients"),
    uz: () => import("./locales/uz.doctor-patients"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-patients"),
    kz: () => import("./locales/kz.doctor-patients"),
    kg: () => import("./locales/kg.doctor-patients"),
    tj: () => import("./locales/tj.doctor-patients"),
  },
  "doctor-treatment": {
    ru: () => import("./locales/ru.doctor-treatment"),
    uz: () => import("./locales/uz.doctor-treatment"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-treatment"),
    kz: () => import("./locales/kz.doctor-treatment"),
    kg: () => import("./locales/kg.doctor-treatment"),
    tj: () => import("./locales/tj.doctor-treatment"),
  },
  "doctor-finance": {
    ru: () => import("./locales/ru.doctor-finance"),
    uz: () => import("./locales/uz.doctor-finance"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-finance"),
    kz: () => import("./locales/kz.doctor-finance"),
    kg: () => import("./locales/kg.doctor-finance"),
    tj: () => import("./locales/tj.doctor-finance"),
  },
  "doctor-ops": {
    ru: () => import("./locales/ru.doctor-ops"),
    uz: () => import("./locales/uz.doctor-ops"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-ops"),
    kz: () => import("./locales/kz.doctor-ops"),
    kg: () => import("./locales/kg.doctor-ops"),
    tj: () => import("./locales/tj.doctor-ops"),
  },
  "doctor-profile": {
    ru: () => import("./locales/ru.doctor-profile"),
    uz: () => import("./locales/uz.doctor-profile"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-profile"),
    kz: () => import("./locales/kz.doctor-profile"),
    kg: () => import("./locales/kg.doctor-profile"),
    tj: () => import("./locales/tj.doctor-profile"),
  },
  "doctor-communication": {
    ru: () => import("./locales/ru.doctor-communication"),
    uz: () => import("./locales/uz.doctor-communication"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-communication"),
    kz: () => import("./locales/kz.doctor-communication"),
    kg: () => import("./locales/kg.doctor-communication"),
    tj: () => import("./locales/tj.doctor-communication"),
  },
  "doctor-market": {
    ru: () => import("./locales/ru.doctor-market"),
    uz: () => import("./locales/uz.doctor-market"),
    uz_cyrl: () => import("./locales/uz_cyrl.doctor-market"),
    kz: () => import("./locales/kz.doctor-market"),
    kg: () => import("./locales/kg.doctor-market"),
    tj: () => import("./locales/tj.doctor-market"),
  },
  patient: {
    ru: () => import("./locales/ru.patient"),
    uz: () => import("./locales/uz.patient"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient"),
    kz: () => import("./locales/kz.patient"),
    kg: () => import("./locales/kg.patient"),
    tj: () => import("./locales/tj.patient"),
  },
  "patient-core": {
    ru: () => import("./locales/ru.patient-core"),
    uz: () => import("./locales/uz.patient-core"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-core"),
    kz: () => import("./locales/kz.patient-core"),
    kg: () => import("./locales/kg.patient-core"),
    tj: () => import("./locales/tj.patient-core"),
  },
  "patient-dashboard": {
    ru: () => import("./locales/ru.patient-dashboard"),
    uz: () => import("./locales/uz.patient-dashboard"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-dashboard"),
    kz: () => import("./locales/kz.patient-dashboard"),
    kg: () => import("./locales/kg.patient-dashboard"),
    tj: () => import("./locales/tj.patient-dashboard"),
  },
  "patient-appointments": {
    ru: () => import("./locales/ru.patient-appointments"),
    uz: () => import("./locales/uz.patient-appointments"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-appointments"),
    kz: () => import("./locales/kz.patient-appointments"),
    kg: () => import("./locales/kg.patient-appointments"),
    tj: () => import("./locales/tj.patient-appointments"),
  },
  "patient-doctors": {
    ru: () => import("./locales/ru.patient-doctors"),
    uz: () => import("./locales/uz.patient-doctors"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-doctors"),
    kz: () => import("./locales/kz.patient-doctors"),
    kg: () => import("./locales/kg.patient-doctors"),
    tj: () => import("./locales/tj.patient-doctors"),
  },
  "patient-family": {
    ru: () => import("./locales/ru.patient-family"),
    uz: () => import("./locales/uz.patient-family"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-family"),
    kz: () => import("./locales/kz.patient-family"),
    kg: () => import("./locales/kg.patient-family"),
    tj: () => import("./locales/tj.patient-family"),
  },
  "patient-communication": {
    ru: () => import("./locales/ru.patient-communication"),
    uz: () => import("./locales/uz.patient-communication"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-communication"),
    kz: () => import("./locales/kz.patient-communication"),
    kg: () => import("./locales/kg.patient-communication"),
    tj: () => import("./locales/tj.patient-communication"),
  },
  "patient-finance": {
    ru: () => import("./locales/ru.patient-finance"),
    uz: () => import("./locales/uz.patient-finance"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-finance"),
    kz: () => import("./locales/kz.patient-finance"),
    kg: () => import("./locales/kg.patient-finance"),
    tj: () => import("./locales/tj.patient-finance"),
  },
  "patient-files": {
    ru: () => import("./locales/ru.patient-files"),
    uz: () => import("./locales/uz.patient-files"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-files"),
    kz: () => import("./locales/kz.patient-files"),
    kg: () => import("./locales/kg.patient-files"),
    tj: () => import("./locales/tj.patient-files"),
  },
  "patient-history": {
    ru: () => import("./locales/ru.patient-history"),
    uz: () => import("./locales/uz.patient-history"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-history"),
    kz: () => import("./locales/kz.patient-history"),
    kg: () => import("./locales/kg.patient-history"),
    tj: () => import("./locales/tj.patient-history"),
  },
  "patient-access": {
    ru: () => import("./locales/ru.patient-access"),
    uz: () => import("./locales/uz.patient-access"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-access"),
    kz: () => import("./locales/kz.patient-access"),
    kg: () => import("./locales/kg.patient-access"),
    tj: () => import("./locales/tj.patient-access"),
  },
  "patient-book": {
    ru: () => import("./locales/ru.patient-book"),
    uz: () => import("./locales/uz.patient-book"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-book"),
    kz: () => import("./locales/kz.patient-book"),
    kg: () => import("./locales/kg.patient-book"),
    tj: () => import("./locales/tj.patient-book"),
  },
  "patient-medical": {
    ru: () => import("./locales/ru.patient-medical"),
    uz: () => import("./locales/uz.patient-medical"),
    uz_cyrl: () => import("./locales/uz_cyrl.patient-medical"),
    kz: () => import("./locales/kz.patient-medical"),
    kg: () => import("./locales/kg.patient-medical"),
    tj: () => import("./locales/tj.patient-medical"),
  },
  admin: {
    ru: () => import("./locales/ru.admin"),
    uz: () => import("./locales/uz.admin"),
    uz_cyrl: () => import("./locales/uz_cyrl.admin"),
    kz: () => import("./locales/kz.admin"),
    kg: () => import("./locales/kg.admin"),
    tj: () => import("./locales/tj.admin"),
  },
  commerce: {
    ru: () => import("./locales/ru.commerce"),
    uz: () => import("./locales/uz.commerce"),
    uz_cyrl: () => import("./locales/uz_cyrl.commerce"),
    kz: () => import("./locales/kz.commerce"),
    kg: () => import("./locales/kg.commerce"),
    tj: () => import("./locales/tj.commerce"),
  },
  ops: {
    ru: () => import("./locales/ru.ops"),
    uz: () => import("./locales/uz.ops"),
    uz_cyrl: () => import("./locales/uz_cyrl.ops"),
    kz: () => import("./locales/kz.ops"),
    kg: () => import("./locales/kg.ops"),
    tj: () => import("./locales/tj.ops"),
  },
};

function isDictionary(value: unknown): value is TranslationDictionary {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class LocaleLoader {
  private readonly cache = new Map<string, TranslationDictionary>();
  private readonly pending = new Map<string, Promise<TranslationDictionary>>();

  constructor(private readonly importers: LocaleImporters | LocaleNamespaceImporters = localeImporters) {}

  load(language: Language, namespace: LocaleNamespace = "base"): Promise<TranslationDictionary> {
    const cacheKey = `${namespace}:${language}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    const pending = this.pending.get(cacheKey);
    if (pending) return pending;

    const request = this.getImporter(language, namespace)()
      .then((module) => {
        if (!isDictionary(module.default)) {
          throw new Error(
            `Locale module "${namespace}:${language}" has an invalid default export`,
          );
        }

        this.cache.set(cacheKey, module.default);
        return module.default;
      })
      .finally(() => {
        this.pending.delete(cacheKey);
      });

    this.pending.set(cacheKey, request);
    return request;
  }

  getLoaded(language: Language, namespace: LocaleNamespace = "base"): TranslationDictionary | undefined {
    return this.cache.get(`${namespace}:${language}`);
  }

  private getImporter(language: Language, namespace: LocaleNamespace): LocaleImporter {
    if ("base" in this.importers) {
      const namespaceImporters = this.importers[namespace];
      if (!namespaceImporters) {
        throw new Error(`Locale namespace "${namespace}" is not configured`);
      }
      return namespaceImporters[language];
    }

    if (namespace !== "base") {
      throw new Error(`Locale namespace "${namespace}" is not configured`);
    }

    return this.importers[language];
  }
}

export const localeLoader = new LocaleLoader();

export function prefetchLocale(language: Language): void {
  void localeLoader.load(language).catch(() => undefined);
}
