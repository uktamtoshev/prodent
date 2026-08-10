import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import ru from "./locales/ru";
import uz from "./locales/uz";
import type { TranslationDictionary } from "./types";

const REQUIRED_KEYS = [
  "publicBooking.doctorNotFound",
  "publicBooking.bookingTitle",
  "booking.onlineUnavailable",
  "booking.chooseService",
  "booking.confirmAppointment",
  "patientCabinet.cancelReasonLabel",
  "patientCabinet.historyChanges",
  "patientCabinet.rescheduleUnavailable",
  "search.newDoctor",
  "search.cityFergana",
  "search.districtMirzoUlugbek",
  "search.loadError",
  "search.priceFromLabel",
  "search.priceToLabel",
] as const;

const USER_FACING_SOURCES = [
  "src/pages/PublicBooking.tsx",
  "src/components/booking/BookingForm.tsx",
  "src/pages/patient/PatientAppointments.tsx",
  "src/pages/Search.tsx",
] as const;

const FORBIDDEN_USER_LITERALS = [
  "Врач не найден",
  "Запись на прием",
  "Онлайн-запись сейчас недоступна",
  "Выберите услугу",
  "Причина отмены",
  "История изменений",
  "Отмена + новая запись",
  "Не удалось загрузить",
  "сегодня 14:30",
] as const;

function lookup(dictionary: TranslationDictionary, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    return (value as TranslationDictionary)[part];
  }, dictionary);
}

describe("main flow localization", () => {
  it.each(REQUIRED_KEYS)("defines %s in Russian and Uzbek", (key) => {
    const russian = lookup(ru, key);
    const uzbek = lookup(uz, key);

    expect(russian).toEqual(expect.any(String));
    expect(uzbek).toEqual(expect.any(String));
    expect(russian).not.toBe(key);
    expect(uzbek).not.toBe(russian);
  });

  it("keeps visible copy out of the four high-traffic source files", () => {
    const source = USER_FACING_SOURCES
      .map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), "utf8"))
      .join("\n");

    for (const literal of FORBIDDEN_USER_LITERALS) {
      expect(source).not.toContain(literal);
    }
  });
});
