import { describe, expect, it } from "vitest";

import { localeImporters } from "./locale-loader";
import { getAppTranslationNamespaces } from "./route-namespaces";
import {
  SUPPORTED_LANGUAGES,
  type TranslationDictionary,
} from "./types";

const marketKeys = [
  "market.catalogTitle",
  "market.catalogSubtitle",
  "market.allCategories",
  "market.categories",
  "market.searchPlaceholder",
  "market.loadError",
  "market.retry",
  "market.emptyCatalog",
  "market.emptyCatalogDescription",
  "market.nothingFound",
  "market.changeSearchOrCategory",
  "market.supplierFallback",
  "market.previous",
  "market.page",
  "market.next",
  "market.itemsShort",
  "market.goToCart",
  "market.currencyUzs",
  "market.service",
  "market.product",
  "market.unitPiece",
  "market.outOfStock",
  "market.addToCart",
  "market.sortLabel",
  "market.sortNew",
  "market.sortCheap",
  "market.sortExpensive",
  "market.sortName",
  "market.priceFrom",
  "market.priceTo",
  "market.inStock",
  "market.found",
  "market.decreaseQuantity",
  "market.increaseQuantity",
] as const;

function lookup(dictionary: TranslationDictionary, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    return (value as TranslationDictionary)[part];
  }, dictionary);
}

describe("market localization", () => {
  it.each(SUPPORTED_LANGUAGES)(
    "%s has every market UI translation in commerce",
    async (language) => {
      const dictionary = (await localeImporters.commerce![language]()).default;

      for (const key of marketKeys) {
        const value = lookup(dictionary, key);
        expect(value, `commerce:${language}:${key}`).toEqual(expect.any(String));
        expect(String(value).trim()).not.toBe("");
      }
    },
  );

  it("the market route loads commerce translations", () => {
    expect(getAppTranslationNamespaces("/market")).toContain("commerce");
  });
});
