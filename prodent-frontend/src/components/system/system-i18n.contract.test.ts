import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import ruBase from "@/i18n/locales/ru.base";
import uzBase from "@/i18n/locales/uz.base";
import uzCyrlBase from "@/i18n/locales/uz_cyrl.base";
import kzBase from "@/i18n/locales/kz.base";
import kgBase from "@/i18n/locales/kg.base";
import tjBase from "@/i18n/locales/tj.base";

/**
 * The design-system layer must not ship user-visible text of its own.
 *
 * PRODENT runs in six languages. `DataTable` used to default to "Нет данных",
 * `AppShell` to "Перейти к содержимому" and `SkeletonComposition` to "Загрузка".
 * Every screen migrated onto the design system would therefore have pushed
 * Russian strings into the Uzbek, Kazakh, Kyrgyz and Tajik interface — adopting
 * the shared layer made those clinics' UI worse, which is a large part of why
 * the layer sat unused in 1 file out of 192.
 *
 * Labels now come from the always-loaded `system.*` locale namespace.
 */

const SYSTEM_DIR = resolve(process.cwd(), "src/components/system");

/** Strip comments so explanatory Russian in a comment does not trip the gate. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[^\n]*?\/\/.*$/gm, "");
}

const componentFiles = readdirSync(SYSTEM_DIR).filter(
  (name) =>
    (name.endsWith(".tsx") || name.endsWith(".ts")) &&
    !name.includes(".test.") &&
    name !== "index.ts",
);

describe("design-system layer carries no hardcoded UI text", () => {
  it("finds the component files to check", () => {
    // Guard against the glob silently matching nothing.
    expect(componentFiles.length).toBeGreaterThan(10);
  });

  it.each(componentFiles)("%s has no Cyrillic string literals", (name) => {
    const source = stripComments(readFileSync(resolve(SYSTEM_DIR, name), "utf8"));

    const offenders = source.match(/["'`][^"'`]*[А-Яа-яЁё][^"'`]*["'`]/g) ?? [];
    expect(
      offenders,
      `${name} ships hardcoded text; move it to the system.* locale namespace`,
    ).toEqual([]);
  });
});

describe("system.* locale namespace", () => {
  const LOCALES = {
    ru: ruBase,
    uz: uzBase,
    uz_cyrl: uzCyrlBase,
    kz: kzBase,
    kg: kgBase,
    tj: tjBase,
  } as const;

  const systemOf = (dictionary: unknown) =>
    (dictionary as { system?: Record<string, string> }).system;

  it("exists in every language", () => {
    for (const [language, dictionary] of Object.entries(LOCALES)) {
      expect(systemOf(dictionary), `${language}.base is missing system.*`).toBeDefined();
    }
  });

  it("defines the same keys in every language", () => {
    const reference = Object.keys(systemOf(LOCALES.ru) ?? {}).sort();
    expect(reference.length).toBeGreaterThan(10);

    for (const [language, dictionary] of Object.entries(LOCALES)) {
      expect(
        Object.keys(systemOf(dictionary) ?? {}).sort(),
        `${language} system.* keys differ from ru`,
      ).toEqual(reference);
    }
  });

  it("keeps the {page}/{pageCount} placeholders in every translation", () => {
    // The pagination label is interpolated, so a translation that drops a
    // placeholder would silently render "Page of".
    for (const [language, dictionary] of Object.entries(LOCALES)) {
      const pageOf = systemOf(dictionary)?.pageOf ?? "";
      expect(pageOf, `${language}.system.pageOf`).toContain("{page}");
      expect(pageOf, `${language}.system.pageOf`).toContain("{pageCount}");
    }
  });

  /**
   * Keys whose translation is legitimately identical to Russian. "Хронология"
   * is the same internationalism in every Cyrillic-script language we ship, so
   * an identical string here is a correct translation, not a forgotten one.
   * Add to this list only with a reason.
   */
  const SHARED_WITH_RUSSIAN: Partial<Record<keyof typeof LOCALES, string[]>> = {
    uz_cyrl: ["timeline"],
    kz: ["timeline"],
    kg: ["timeline"],
    tj: ["timeline"],
  };

  it("does not leave a non-Russian locale showing Russian", () => {
    const ru = systemOf(LOCALES.ru) ?? {};
    for (const [language, dictionary] of Object.entries(LOCALES)) {
      if (language === "ru") continue;
      const allowed = SHARED_WITH_RUSSIAN[language as keyof typeof LOCALES] ?? [];
      const localized = systemOf(dictionary) ?? {};
      const copiedVerbatim = Object.keys(ru).filter(
        (key) => localized[key] === ru[key] && !allowed.includes(key),
      );
      expect(
        copiedVerbatim,
        `${language} reuses the Russian string for these keys`,
      ).toEqual([]);
    }
  });
});
