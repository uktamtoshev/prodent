import { describe, expect, it } from "vitest";

import { localeImporters, type LocaleNamespace } from "./locale-loader";
import { getAppTranslationNamespaces } from "./route-namespaces";
import {
  SUPPORTED_LANGUAGES,
  type TranslationDictionary,
} from "./types";

const criticalPageKeys: Partial<Record<LocaleNamespace, readonly string[]>> = {
  "crm-patients": [
    "crmPatients.title",
    "crmPatients.searchPlaceholder",
    "crmPatientSearch.subtitle",
    "crmPatientSearch.duplicatesMerged",
    "crmPatientSearch.possibleDuplicates",
    "crmPatientSearch.merge",
    "crmPatientSearch.minSearchLength",
    "crmPatientSearch.loadError",
    "crmPatientSearch.retry",
    "crmPatientSearch.guest",
    "crmPatientSearch.registered",
    "crmPatientSearch.notFound",
  ],
  ops: [
    "labOrdersPage.title",
    "labOrdersPage.subtitle",
  ],
};

function lookup(dictionary: TranslationDictionary, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    return (value as TranslationDictionary)[part];
  }, dictionary);
}

describe("critical page localization", () => {
  it.each(SUPPORTED_LANGUAGES)(
    "%s has every Patients and LabOrders translation",
    async (language) => {
      for (const [namespace, keys] of Object.entries(criticalPageKeys) as [
        LocaleNamespace,
        readonly string[],
      ][]) {
        const dictionary = (await localeImporters[namespace]![language]()).default;

        for (const key of keys) {
          expect(lookup(dictionary, key), `${namespace}:${language}:${key}`)
            .toEqual(expect.any(String));
          expect(String(lookup(dictionary, key)).trim()).not.toBe("");
        }
      }
    },
  );

  it("routes load the namespaces used by both pages", () => {
    expect(getAppTranslationNamespaces("/crm/patients")).toContain("crm-patients");
    expect(getAppTranslationNamespaces("/lab/orders")).toContain("ops");
  });
});
