import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Компактные размеры кабинета и тач-цель.
 *
 * В макете кнопка 36px, малая 29px, поле 36px. Это НИЖЕ нормы тач-цели 44px,
 * поэтому компактность даётся только мыши: класс `cabinet-control` возвращает
 * 44px внутри `@media (pointer: coarse)`.
 *
 * Здесь закреплена связка, которую легко потерять: любой компактный размер
 * ОБЯЗАН нести `cabinet-control`. Если кто-то добавит размер 36px без него,
 * кнопка станет непопадаемой пальцем, и заметит это только пользователь
 * телефона — то есть никто из тех, кто правит код.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const BUTTON = read("src/components/ui/button.tsx");
const CSS = read("src/index.css");

describe("компактная плотность кабинета", () => {
  it("держит правило возврата к 44px на касании", () => {
    // Явный тип: без него `?? []` даёт union с never[], и .find сужается до never.
    const coarse: string[] = CSS.match(/@media \(pointer: coarse\)\s*\{[\s\S]*?\n\}/g) ?? [];
    const rule = coarse.find((block) => block.includes(".cabinet-control"));

    expect(rule, "нет правила .cabinet-control внутри @media (pointer: coarse)").toBeDefined();
    expect(rule).toMatch(/min-height:\s*2\.75rem/);
  });

  it("каждый компактный размер кнопки несёт cabinet-control", () => {
    // Строки вида `cabinet: "..."` внутри блока size.
    const sizes = [...BUTTON.matchAll(/"?(cabinet[a-z-]*)"?:\s*"([^"]*)"/g)];

    expect(sizes.length, "компактные размеры не найдены").toBeGreaterThan(0);

    for (const [, name, classes] of sizes) {
      expect(classes, `размер ${name} без cabinet-control`).toContain("cabinet-control");
    }
  });

  it("не трогает размер по умолчанию: 48px нужен вне кабинета", () => {
    // Лендинг и кабинет пациента живут на этом размере, плотность кабинета
    // им не подходит. Контракт profile-ui-sprint1 проверяет ту же строку.
    expect(BUTTON).toContain("h-prodent-btn");
  });
});
