import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * JSX-комментарий не может стоять первым в ветке, которая возвращает элемент.
 *
 * `return (` и `? (` ожидают ОДНО выражение. Блок `{/* ... *\/}` — это тоже
 * выражение, поэтому рядом с элементом их получается два, и разметка
 * перестаёт разбираться.
 *
 * Ошибка коварна тем, что её не ловит ничего из обычных проверок: типы в этом
 * проекте не запускаются штатной командой, а тесты нужного файла либо
 * подменяют его заглушкой, либо читают как текст. Падает только сборка в
 * браузере — то есть замечает пользователь, а не автор.
 *
 * За одну сессию так сломались два файла подряд, поэтому правило вынесено в
 * тест: комментарий должен стоять ВЫШЕ return, обычным `//`, либо ВНУТРИ
 * элемента.
 */
const SRC = resolve(process.cwd(), "src");

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** `return (` или `? (`, за которым сразу идёт блок JSX-комментария. */
const MISPLACED = /(?:return|\?)\s*\(\s*\n\s*\{\s*\/\*/g;

describe("размещение JSX-комментариев", () => {
  it("не ставит комментарий первым выражением в возвращаемой ветке", () => {
    const offenders: string[] = [];

    for (const file of collect(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(MISPLACED)) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${file.slice(SRC.length + 1).replace(/\\/g, "/")}:${line}`);
      }
    }

    expect(
      offenders,
      "комментарий стоит вторым выражением рядом с элементом — разметка не соберётся. " +
        "Поставьте его выше return обычным // или внутрь элемента.",
    ).toEqual([]);
  });
});
