import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import kgOps from "@/i18n/locales/kg.ops";
import kzOps from "@/i18n/locales/kz.ops";
import ruOps from "@/i18n/locales/ru.ops";
import tjOps from "@/i18n/locales/tj.ops";
import uzOps from "@/i18n/locales/uz.ops";
import uzCyrlOps from "@/i18n/locales/uz_cyrl.ops";

const customerSource = readFileSync(
  "src/components/lab/LabOrdersCustomer.tsx",
  "utf8",
);
const workflowSource = readFileSync("src/lib/lab-workflow.ts", "utf8");

const dictionaries = [ruOps, uzOps, uzCyrlOps, kzOps, kgOps, tjOps] as Array<
  Record<string, unknown>
>;

function lookup(dictionary: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part];
  }, dictionary);
}

describe("lab customer localization contract", () => {
  it("does not use a Russian/Uzbek binary switch", () => {
    expect(customerSource).not.toContain('language === "uz"');
    expect(customerSource).not.toMatch(/\btx\(\s*["'][^"']+["']\s*,/);
    expect(workflowSource).not.toContain("RU_STATUS");
    expect(workflowSource).not.toContain("UZ_STATUS");
  });

  it("does not keep former Russian UI literals in the component", () => {
    for (const literal of [
      ">Срочно<",
      '"Без пациента"',
      "(из избранных)",
      "Нет избранных лабораторий",
      "Прайс техника —",
      'placeholder="Циркониевая',
      'placeholder="Юсупов',
      ">сум (UZS)<",
      ">доллар ($)<",
      'placeholder="Особенности прикуса',
    ]) {
      expect(customerSource).not.toContain(literal);
    }
  });

  it("defines every used labCustomer key in all six ops dictionaries", () => {
    const keys = new Set(
      [...customerSource.matchAll(/tx\("([^"]+)"\)/g)].map(
        ([, key]) => `labCustomer.${key}`,
      ),
    );

    expect(keys.size).toBeGreaterThan(40);
    for (const dictionary of dictionaries) {
      for (const key of keys) {
        expect(lookup(dictionary, key), key).toEqual(expect.any(String));
      }
    }
  });

  it("keeps workflow labels in the loaded ops namespace", () => {
    for (const dictionary of dictionaries) {
      for (const status of [
        "new",
        "queued",
        "model",
        "wax",
        "milling",
        "frame",
        "glaze",
        "ready",
        "delivered",
        "cancelled",
        "declined",
      ]) {
        expect(lookup(dictionary, `labCustomer.status.${status}`)).toEqual(
          expect.any(String),
        );
      }
    }
  });
});
