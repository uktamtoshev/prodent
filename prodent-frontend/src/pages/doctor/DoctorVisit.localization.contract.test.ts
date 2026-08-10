import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import kgDoctorSchedule from "@/i18n/locales/kg.doctor-schedule";
import kzDoctorSchedule from "@/i18n/locales/kz.doctor-schedule";
import ruDoctorSchedule from "@/i18n/locales/ru.doctor-schedule";
import tjDoctorSchedule from "@/i18n/locales/tj.doctor-schedule";
import uzDoctorSchedule from "@/i18n/locales/uz.doctor-schedule";
import uzCyrlDoctorSchedule from "@/i18n/locales/uz_cyrl.doctor-schedule";

const visitSource = readFileSync("src/pages/doctor/DoctorVisit.tsx", "utf8");
const schedules = [
  ruDoctorSchedule,
  uzDoctorSchedule,
  uzCyrlDoctorSchedule,
  kzDoctorSchedule,
  kgDoctorSchedule,
  tjDoctorSchedule,
] as const;

const requiredKeys = [
  "complaints",
  "examination",
  "procedures",
  "recommendations",
  "privateNotes",
  "draftSaved",
  "draftSaving",
  "draftSyncError",
  "draftConflict",
  "useServerVersion",
  "keepMyVersion",
  "draftVersionHistory",
  "draftOffline",
  "clinicalEntryRequired",
  "medicalCardHistory",
  "print",
  "waitForDraftSave",
  "finishConflict",
  "finishError",
  "visitItemsEmpty",
  "visitCostFromPlan",
  "visitClinic",
] as const;

describe("DoctorVisit localization contract", () => {
  it("keeps every visible visit message in all six language dictionaries", () => {
    for (const schedule of schedules) {
      for (const key of requiredKeys) {
        const value = schedule.doctorVisit[key];
        expect(value, key).toBeTypeOf("string");
        expect(value.trim(), key).not.toBe("");
      }
    }
  });

  it("does not reuse Russian visit copy for other languages", () => {
    for (const schedule of schedules.slice(1)) {
      for (const key of requiredKeys) {
        expect(schedule.doctorVisit[key], key).not.toBe(
          ruDoctorSchedule.doctorVisit[key],
        );
      }
    }
  });

  it("uses shared localization and has no manual RU/UZ copy branch", () => {
    expect(visitSource).toContain('from "@/lib/localization"');
    expect(visitSource).toContain("formatDate(");
    expect(visitSource).toContain("formatTime(");
    expect(visitSource).not.toContain("visitCopy");
    expect(visitSource).not.toContain("isUzbek");
    expect(visitSource).not.toContain('from "date-fns"');
    expect(visitSource).not.toContain("locale: ru");
  });

  it("has no known visible Russian fallback strings", () => {
    for (const copy of [
      '|| "Анамнез"',
      '|| "Зубы"',
      '|| "Диагноз"',
      '|| "Лечение"',
      '|| "Сначала дождитесь сохранения черновика на сервере"',
      '"Позиции за визит пока не добавлены"',
      '"Стоимость формируется из плана лечения"',
      '"Клиника приёма"',
    ]) {
      expect(visitSource).not.toContain(copy);
    }
  });
});
