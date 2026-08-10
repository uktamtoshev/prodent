import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Целостность index.css.
 *
 * Здесь закреплена ошибка, которая уже случилась и которую НЕ ловит ни один
 * инструмент проекта: в комментарии была написана маска класса со звёздочкой и
 * слэшем подряд. Эта пара закрывает комментарий досрочно, остаток текста
 * становится «селекторами», и все правила ниже перестают действовать.
 *
 * Симптом коварный: сборка не падает, типы чисты, тесты зелёные — просто часть
 * оформления молча не применяется. Поймать это можно только разбором файла.
 */
const CSS = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/** Текст без комментариев — то, что реально видит браузер. */
const withoutComments = CSS.replace(/\/\*[\s\S]*?\*\//g, " ");

describe("index.css остаётся разбираемым", () => {
  it("не закрывает комментарий посреди слова", () => {
    // Закрывающая пара обязана стоять после пробела или переноса строки.
    // `bg-status-*/5` внутри комментария — ровно тот случай, что ломал файл.
    const premature = [...CSS.matchAll(/\S\*\//g)].map((m) => {
      const line = CSS.slice(0, m.index).split("\n").length;
      return `строка ${line}`;
    });

    expect(
      premature,
      "комментарий закрыт посреди слова: всё, что ниже, браузер разберёт как мусор",
    ).toEqual([]);
  });

  it("держит скобки в балансе", () => {
    const open = (withoutComments.match(/\{/g) ?? []).length;
    const close = (withoutComments.match(/\}/g) ?? []).length;

    expect(open).toBe(close);
  });

  it("не содержит селекторов из обычного текста", () => {
    // Кириллица в селекторе означает, что в CSS утёк комментарий.
    const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)].map((m) =>
      m[1].trim().replace(/\s+/g, " "),
    );
    const garbage = selectors.filter((s) => /[а-яА-ЯёЁ]/.test(s));

    expect(garbage.slice(0, 3), "в CSS утёк текст комментария").toEqual([]);
  });

  it("сохраняет правила, которые лежат в самом конце файла", () => {
    // Если комментарий выше закроется досрочно, эти правила исчезнут первыми,
    // потому что они последние. Проверяем именно их как канарейку.
    expect(withoutComments).toContain(".cabinet-page-title");
    expect(withoutComments).toContain(".cabinet-control");
    expect(withoutComments).toContain("html[data-cabinet]");
  });
});
