import { describe, expect, it } from "vitest";

import { localeImporters } from "./locale-loader";
import { getAppTranslationNamespaces } from "./route-namespaces";
import {
  SUPPORTED_LANGUAGES,
  type TranslationDictionary,
} from "./types";

const skladKeys = [
  "sklad.title",
  "sklad.subtitle",
  "sklad.loadError",
  "sklad.deleteConfirm",
  "sklad.itemDeleted",
  "sklad.deleteError",
  "sklad.income",
  "sklad.expense",
  "sklad.adjustment",
  "sklad.transfer",
  "sklad.inventoryCount",
  "sklad.exportError",
  "sklad.export",
  "sklad.addItem",
  "sklad.statItems",
  "sklad.statLow",
  "sklad.belowMinimum",
  "sklad.statExpiring",
  "sklad.within30Days",
  "sklad.warehouseValue",
  "sklad.currencyUzs",
  "sklad.searchPlaceholder",
  "sklad.all",
  "sklad.tableItem",
  "sklad.tableCategory",
  "sklad.tableStock",
  "sklad.tableExpiry",
  "sklad.tableStatus",
  "sklad.tablePrice",
  "sklad.tableActions",
  "sklad.loading",
  "sklad.emptyWarehouse",
  "sklad.nothingFound",
  "sklad.addFirstItem",
  "sklad.changeFilters",
  "sklad.minimum",
  "sklad.edit",
  "sklad.delete",
  "sklad.shown",
  "sklad.of",
  "sklad.lowStockWarning",
  "sklad.status.ok",
  "sklad.status.low",
  "sklad.status.critical",
  "sklad.status.out",
  "sklad.status.expiring",
] as const;

function lookup(dictionary: TranslationDictionary, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    return (value as TranslationDictionary)[part];
  }, dictionary);
}

describe("sklad localization", () => {
  it.each(SUPPORTED_LANGUAGES)(
    "%s has every warehouse UI translation in ops",
    async (language) => {
      const dictionary = (await localeImporters.ops![language]()).default;

      for (const key of skladKeys) {
        const value = lookup(dictionary, key);
        expect(value, `ops:${language}:${key}`).toEqual(expect.any(String));
        expect(String(value).trim()).not.toBe("");
      }
    },
  );

  it("the warehouse route loads ops translations", () => {
    expect(getAppTranslationNamespaces("/sklad")).toContain("ops");
  });
});
