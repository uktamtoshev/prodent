import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Глубина рабочей области кабинета задаётся переопределением токенов на
 * обёртке [data-workspace-bg]. Здесь закреплена одна ловушка, которая уже
 * ломала тёмную тему.
 *
 * Объявление на потомке сильнее унаследованного: `.dark` висит на <html>, а
 * обёртка кабинета лежит глубже. Поэтому безусловное правило
 * `[data-workspace-bg] { --background: <светлый> }` перебивает тёмную тему —
 * холст остаётся светлым, а текст на нём светлый, контраст 1.05:1.
 *
 * Глазами это видно только если переключиться в тёмную тему, поэтому проверка
 * живёт в тестах: КАЖДОЕ переопределение --background на обёртке кабинета
 * обязано быть привязано к конкретной теме.
 */
// Комментарии вырезаем ДО разбора: иначе текст перед правилом попадает в
// «селектор», и упоминание .dark в пояснении делает проверку слепой.
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  " ",
);

/** Селекторы правил, которые переопределяют --background на обёртке кабинета. */
const workspaceBackgroundRules = () => {
  const rules: string[] = [];
  // Простой разбор: селектор до "{", тело до "}". Вложенных блоков в этих
  // правилах нет, поэтому этого достаточно и не тянет за собой парсер CSS.
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].trim();
    const body = m[2];
    if (!selector.includes("[data-workspace-bg]")) continue;
    if (!/--background\s*:/.test(body)) continue;
    rules.push(selector);
  }
  return rules;
};

describe("глубина рабочей области · токены холста", () => {
  it("переопределяет холст кабинета хотя бы для одной темы", () => {
    expect(workspaceBackgroundRules().length).toBeGreaterThan(0);
  });

  it("привязывает каждое переопределение холста к теме", () => {
    const unscoped = workspaceBackgroundRules().filter(
      (selector) => !/\.dark|:not\(\.dark\)|\.light/.test(selector),
    );

    expect(
      unscoped,
      "Правило меняет --background на обёртке кабинета, но не привязано к теме. " +
        "Оно перебьёт .dark на <html>, и в тёмной теме холст останется светлым. " +
        "Добавьте html:not(.dark) для светлой темы или .dark для тёмной.",
    ).toEqual([]);
  });

  it("задаёт холст обеих тем, иначе одна из них останется без глубины", () => {
    const selectors = workspaceBackgroundRules();

    expect(selectors.some((s) => /:not\(\.dark\)|\.light/.test(s))).toBe(true);
    expect(selectors.some((s) => /\.dark/.test(s))).toBe(true);
  });
});
