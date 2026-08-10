import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Что показывает каждая вкладка приглашений.
 *
 * Секции привязали к вкладке, но блок «запросы на удаление» остался без
 * условия и показывался на ОБЕИХ вкладках. На «Текущих клиниках» это выглядит
 * как чужой раздел: там список мест работы, а не входящие обращения.
 *
 * Проверка идёт по исходнику: компонент тянет четыре контекста, свой запрос и
 * мутации, и поднять его в тесте дороже, чем проверяемое поведение. Условия
 * показа — это ровно те строки, которые ломались, и читаются они однозначно.
 */
const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/doctor/ClinicInvitationsManager.tsx"),
  "utf8",
);

/** Строка с условием показа секции: `{<условие> && (`. */
function conditionFor(marker: string): string {
  const line = SOURCE.split("\n").find(
    (candidate) => candidate.includes(marker) && candidate.trim().startsWith("{"),
  );
  return line?.trim() ?? "";
}

describe("вкладки приглашений показывают своё содержимое", () => {
  it("приглашения — только на вкладке ожидания", () => {
    const condition = conditionFor("pendingInvitations.length > 0");

    expect(condition).toContain("inviteTab === 'pending'");
  });

  it("запросы на удаление — тоже только на вкладке ожидания", () => {
    // Это и есть починенная ошибка: раньше условия по вкладке здесь не было
    // вовсе, и блок протекал на «Текущие клиники».
    const condition = conditionFor("pendingRemovals.length > 0");

    expect(condition, "запросы на удаление не привязаны к вкладке").toContain(
      "inviteTab === 'pending'",
    );
    expect(condition).not.toContain("clinics");
  });

  it("места работы — только на вкладке текущих клиник", () => {
    const condition = conditionFor("myClinics && myClinics.length > 0");

    expect(condition).toContain("inviteTab === 'clinics'");
  });

  it("пустое состояние считается отдельно для каждой вкладки", () => {
    // Режем по закрывающей паре условия «)) && (», а НЕ по первому «&& (»:
    // такая пара встречается и внутри самого условия, и срез обрубал бы
    // проверку списка клиник.
    const empty = SOURCE.slice(SOURCE.indexOf("{((inviteTab === 'pending'"));
    const condition = empty.slice(0, empty.indexOf(")) && ("));

    // Вкладка ожидания пуста, только когда нет НИ приглашений, НИ запросов
    // на удаление: иначе подсказка «пусто» появлялась бы поверх запроса.
    expect(condition).toContain("pendingInvitations.length === 0");
    expect(condition).toContain("pendingRemovals.length === 0");

    // На вкладке клиник пустота зависит только от списка мест работы.
    expect(condition).toContain("inviteTab === 'clinics'");
    expect(condition).toContain("!myClinics || myClinics.length === 0");
  });

  it("общее условие «пусто везде» больше не используется", () => {
    // Старая формулировка требовала пустоты сразу во всех списках, поэтому на
    // пустой вкладке экран был просто белым, без объяснения.
    expect(SOURCE).not.toMatch(
      /pendingInvitations\.length === 0 && pendingRemovals\.length === 0 && \(!myClinics/,
    );
  });
});
