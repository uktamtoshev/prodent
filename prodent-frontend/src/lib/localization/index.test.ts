import { describe, expect, it } from "vitest";

import type { Language } from "@/i18n/types";
import {
  CRITICAL_TERMS,
  formatAmount,
  formatDate,
  formatPhone,
  formatTime,
  localeFor,
} from "@/lib/localization";

const languages: readonly Language[] = ["ru", "uz", "uz_cyrl", "kz", "kg", "tj"];
const instant = "2026-07-24T14:05:00.000Z";

describe("localization format contract", () => {
  it.each([
    ["ru", "ru-RU", "24.07.2026"],
    ["uz", "uz-Latn-UZ", "24/07/2026"],
    ["uz_cyrl", "uz-Cyrl-UZ", "24/07/2026"],
    ["kz", "kk-KZ", "24.07.2026"],
    ["kg", "ky-KG", "2026-24-07"],
    ["tj", "tg-TJ", "24/07/2026"],
  ] as const)("formats dates for %s with the canonical locale", (language, locale, date) => {
    expect(localeFor(language)).toBe(locale);
    expect(formatDate(instant, language, { timeZone: "UTC" })).toBe(date);
  });

  it.each(languages)("formats 24-hour time and amounts for %s", (language) => {
    expect(formatTime(instant, language, { timeZone: "UTC" })).toBe("14:05");
    expect(formatAmount(1_234_567, language)).toBe(`1\u00a0234\u00a0567`);
  });

  it.each([
    ["ru", "901234567", "+998 90 123 45 67"],
    ["uz", "901234567", "+998 90 123 45 67"],
    ["uz_cyrl", "901234567", "+998 90 123 45 67"],
    ["kz", "7011234567", "+7 701 123 45 67"],
    ["kg", "555123456", "+996 555 123 456"],
    ["tj", "901234567", "+992 90 123 4567"],
  ] as const)("formats a local phone for %s", (language, phone, expected) => {
    expect(formatPhone(phone, language)).toBe(expected);
  });

  it("returns a safe placeholder for invalid values", () => {
    expect(formatDate("not-a-date", "ru")).toBe("—");
    expect(formatTime(Number.NaN, "uz")).toBe("—");
    expect(formatAmount(Number.POSITIVE_INFINITY, "kz")).toBe("—");
    expect(formatPhone("", "tj")).toBe("—");
  });
});

describe("critical terminology contract", () => {
  it.each([
    ["ru", ["Визит", "Одонтограмма", "План лечения", "Оплата", "Заказ"]],
    ["uz", ["Tashrif", "Odontogramma", "Davolash rejasi", "Toʻlov", "Buyurtma"]],
    ["uz_cyrl", ["Ташриф", "Одонтограмма", "Даволаш режаси", "Тўлов", "Буюртма"]],
    ["kz", ["Келу", "Одонтограмма", "Емдеу жоспары", "Төлем", "Тапсырыс"]],
    ["kg", ["Келүү", "Одонтограмма", "Дарылоо планы", "Төлөм", "Буйрутма"]],
    ["tj", ["Ташриф", "Одонтограмма", "Нақшаи табобат", "Пардохт", "Фармоиш"]],
  ] as const)("keeps canonical terms for %s", (language, expected) => {
    const terms = CRITICAL_TERMS[language];

    expect([
      terms.visit,
      terms.odontogram,
      terms.treatmentPlan,
      terms.payment,
      terms.order,
    ]).toEqual(expected);
  });
});
