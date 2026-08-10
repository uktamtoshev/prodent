import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Вкладка обязана переключать СОДЕРЖИМОЕ, а не только свой цвет.
 *
 * Эта ошибка уже была допущена трижды: на балансе клиники, балансе врача и в
 * приглашениях клиник появились вкладки со счётчиками, состояние менялось,
 * подсветка работала — а под вкладками всегда показывалось одно и то же.
 * Внешне выглядит как работающий интерфейс, поэтому глазами ловится плохо.
 *
 * Проверка простая: если в файле есть состояние вкладки, оно должно
 * использоваться не только в className/aria-pressed, но и в условии показа
 * содержимого.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/** Файлы со вкладками и имя переменной состояния в каждом. */
const SCREENS: Array<{ file: string; state: string; name: string }> = [
  { file: "src/pages/crm/ClinicBalance.tsx", state: "balanceTab", name: "Баланс клиники" },
  { file: "src/pages/doctor/DoctorBalance.tsx", state: "balanceTab", name: "Баланс врача" },
  { file: "src/components/doctor/ClinicInvitationsManager.tsx", state: "inviteTab", name: "Приглашения клиник" },
  { file: "src/pages/crm/Messages.tsx", state: "chatTab", name: "Сообщения" },
  { file: "src/pages/crm/Patients.tsx", state: "patientTab", name: "Пациенты" },
  { file: "src/components/lab/LabOrdersCustomer.tsx", state: "tab", name: "Лаборатория" },
];

describe("вкладки переключают содержимое", () => {
  it.each(SCREENS)("$name: состояние влияет не только на оформление", ({ file, state }) => {
    const source = read(file);

    // Все места, где встречается состояние вкладки.
    const uses = source.split("\n").filter((line) => line.includes(state));
    expect(uses.length, `${file}: состояние ${state} не найдено`).toBeGreaterThan(0);

    // Строки, где состояние решает только внешний вид.
    const cosmetic = uses.filter(
      (line) =>
        line.includes("aria-pressed")
        || line.includes("className")
        || line.includes("setState")
        || line.includes(`set${state[0].toUpperCase()}${state.slice(1)}`)
        || line.includes("useState"),
    );

    // Должно остаться хотя бы одно место, где состояние управляет ДАННЫМИ или
    // показом блока: фильтрация списка либо условный рендер.
    const meaningful = uses.filter((line) => !cosmetic.includes(line));

    expect(
      meaningful.length,
      `${file}: ${state} влияет только на оформление — вкладка не переключает содержимое`,
    ).toBeGreaterThan(0);
  });

  it("оба баланса показывают операции отдельным блоком", () => {
    for (const file of ["src/pages/crm/ClinicBalance.tsx", "src/pages/doctor/DoctorBalance.tsx"]) {
      const source = read(file);
      expect(source, `${file}: нет блока операций`).toContain("BalanceOperations");
      expect(source, `${file}: операции не привязаны к вкладке`).toMatch(
        /balanceTab === ['"]operations['"]/,
      );
    }
  });

  it("приглашения скрывают чужую секцию на выбранной вкладке", () => {
    const source = read("src/components/doctor/ClinicInvitationsManager.tsx");

    expect(source).toMatch(/inviteTab === ['"]pending['"] && pendingInvitations\.length/);
    expect(source).toMatch(/inviteTab === ['"]clinics['"] && myClinics/);
  });
});
