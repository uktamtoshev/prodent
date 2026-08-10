import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import kgOps from "@/i18n/locales/kg.ops";
import kzOps from "@/i18n/locales/kz.ops";
import ruOps from "@/i18n/locales/ru.ops";
import tjOps from "@/i18n/locales/tj.ops";
import uzOps from "@/i18n/locales/uz.ops";
import uzCyrlOps from "@/i18n/locales/uz_cyrl.ops";

const source = readFileSync("src/components/sklad/SkladShared.tsx", "utf8");
const dictionaries = [ruOps, uzOps, uzCyrlOps, kzOps, kgOps, tjOps] as const;
const dialogKeys = [
  "itemNewTitle", "itemEditTitle", "itemName", "itemNamePlaceholder", "item",
  "category",
  "supplier", "openingStock", "minimumStock", "unit", "pricePerUnit",
  "expiryDate", "brand", "sku", "location", "notes", "cancel", "saving",
  "save", "add", "enterItemName", "itemUpdated", "itemAdded", "saveError",
  "selectItem", "positiveQuantity", "batchRequired", "operationDone",
  "operationError", "newStock", "quantity", "currentStock", "batchNumber",
  "batchExpiry", "appointmentOptional", "appointmentPlaceholder",
  "appointmentHint", "reason", "source", "destination",
  "selectSourceDestination", "differentDestination", "materialsTransferred",
  "transferError", "noLocation", "comment", "moving", "move",
  "inventoryTitle", "systemStock", "actualStock", "note", "nonNegativeStock",
  "inventorySaved", "inventoryError", "inventorySaving", "record",
] as const;

describe("SkladShared localization contract", () => {
  it("has complete dialog copy in all six languages", () => {
    for (const dictionary of dictionaries) {
      for (const key of dialogKeys) {
        const value = dictionary.sklad.dialogs[key];
        expect(value, key).toBeTypeOf("string");
        expect(value.trim(), key).not.toBe("");
      }
    }
  });

  it("does not reuse Russian dialog copy in other languages", () => {
    for (const dictionary of dictionaries.slice(1)) {
      const translatedKeys = dialogKeys.filter(
        (key) => dictionary.sklad.dialogs[key] !== ruOps.sklad.dialogs[key],
      );
      expect(translatedKeys.length).toBeGreaterThan(dialogKeys.length * 0.8);
    }
  });

  it("uses the shared language and number formatters without changing units", () => {
    expect(source).toContain("useLanguage()");
    expect(source).toContain('from "@/lib/localization"');
    expect(source).toContain("formatAmount(");
    expect(source).toContain('const UNITS = ["шт", "уп", "мл", "г", "л", "пара", "набор"]');
    expect(source).not.toContain("const OP_TITLE");
  });

  it("contains no known visible Russian dialog copy", () => {
    for (const text of [
      '"Введите название позиции"',
      '"Позиция обновлена"',
      '"Выберите позицию"',
      '"Количество должно быть больше нуля"',
      '"Перемещение материалов"',
      '"Инвентаризация позиции"',
      ">Отмена<",
    ]) {
      expect(source).not.toContain(text);
    }
  });
});
