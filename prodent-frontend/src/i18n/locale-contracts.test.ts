import { describe, expect, it, vi } from "vitest";

import {
  LocaleLoader,
  localeImporters,
  type LocaleImporter,
  type LocaleNamespace,
  type LocaleNamespaceImporters,
} from "./locale-loader";
import { LanguageRuntime } from "./language-runtime";
import {
  getEffectiveTranslationLeafPaths,
  getTranslationLeafPaths,
  mergeTranslationDictionaries,
} from "./translation-contracts";
import { getAppTranslationNamespaces } from "./route-namespaces";
import {
  SUPPORTED_LANGUAGES,
  type Language,
  type TranslationDictionary,
} from "./types";

const namespaces = Object.keys(localeImporters) as LocaleNamespace[];

describe("locale dictionary contracts", () => {
  it.each(namespaces)(
    "%s has no missing effective translation keys in all six languages",
    async (namespace) => {
      const reference = await localeImporters[namespace]!.ru();
      const expectedPaths = getTranslationLeafPaths(reference.default);

      for (const language of SUPPORTED_LANGUAGES) {
        const localized = await localeImporters[namespace]![language]();
        expect(
          getEffectiveTranslationLeafPaths(reference.default, localized.default),
          `${namespace}:${language}`,
        ).toEqual(expectedPaths);
      }
    },
    60_000,
  );

  it("merges separate branches without losing earlier translations", () => {
    const target: TranslationDictionary = {
      patientCabinet: { dashboard: { title: "Dashboard" } },
    };

    mergeTranslationDictionaries(
      target,
      { patientCabinet: { appointments: { title: "Appointments" } } },
      "patient-appointments",
    );

    expect(target).toEqual({
      patientCabinet: {
        dashboard: { title: "Dashboard" },
        appointments: { title: "Appointments" },
      },
    });
  });

  it("rejects a duplicate leaf key instead of silently overwriting it", () => {
    const target: TranslationDictionary = {
      common: { save: "Save" },
    };

    expect(() =>
      mergeTranslationDictionaries(
        target,
        { common: { save: "Overwrite" } },
        "shared",
      ),
    ).toThrow('Duplicate translation key "common.save" in namespace "shared"');
  });

  it("has no duplicate leaf keys in route namespace combinations", async () => {
    const routes = [
      "/admin/users",
      "/crm",
      "/crm/settings",
      "/doctor/calendar",
      "/doctor/treatment-plans/42",
      "/patient/dashboard",
      "/patient/medical",
      "/seller/orders",
      "/technician/archive",
    ];

    for (const language of SUPPORTED_LANGUAGES) {
      for (const route of routes) {
        const merged: TranslationDictionary = {};
        const routeNamespaces: LocaleNamespace[] = [
          "base",
          ...getAppTranslationNamespaces(route),
        ];

        for (const namespace of routeNamespaces) {
          const dictionary = await localeImporters[namespace]![language]();
          mergeTranslationDictionaries(
            merged,
            dictionary.default,
            namespace,
          );
        }
      }
    }
  });
});

describe("locale loader isolation", () => {
  it("imports only the requested language and namespace", async () => {
    const calls = new Map<string, ReturnType<typeof vi.fn>>();
    const makeLanguageImporters = (namespace: LocaleNamespace) =>
      Object.fromEntries(
        SUPPORTED_LANGUAGES.map((language) => {
          const importer = vi.fn<LocaleImporter>(() =>
            Promise.resolve({
              default: { marker: `${namespace}:${language}` },
            }),
          );
          calls.set(`${namespace}:${language}`, importer);
          return [language, importer];
        }),
      ) as Record<Language, LocaleImporter>;

    const importers: LocaleNamespaceImporters = {
      base: makeLanguageImporters("base"),
      "crm-core": makeLanguageImporters("crm-core"),
    };
    const loader = new LocaleLoader(importers);

    await loader.load("kg", "crm-core");

    expect(calls.get("crm-core:kg")).toHaveBeenCalledOnce();
    for (const [key, importer] of calls) {
      if (key !== "crm-core:kg") expect(importer).not.toHaveBeenCalled();
    }
  });

  it("does not pollute the cached base dictionary when a namespace is merged", async () => {
    const makeImporters = (
      dictionary: TranslationDictionary,
    ): Record<Language, LocaleImporter> =>
      Object.fromEntries(
        SUPPORTED_LANGUAGES.map((language) => [
          language,
          () => Promise.resolve({ default: dictionary }),
        ]),
      ) as Record<Language, LocaleImporter>;
    const loader = new LocaleLoader({
      base: makeImporters({ common: { save: "Save" } }),
      "patient-core": makeImporters({
        patientCabinet: { dashboard: "Dashboard" },
      }),
    });
    const runtime = new LanguageRuntime(loader);

    await runtime.switchLanguage("uz");
    await runtime.loadNamespace("patient-core");

    expect(loader.getLoaded("uz")).toEqual({ common: { save: "Save" } });
    expect(loader.getLoaded("ru")).toEqual({ common: { save: "Save" } });
  });
});
