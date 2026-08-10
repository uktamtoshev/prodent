import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import ru from "@/i18n/locales/ru.base";
import uz from "@/i18n/locales/uz.base";
import uzCyrl from "@/i18n/locales/uz_cyrl.base";
import kz from "@/i18n/locales/kz.base";
import kg from "@/i18n/locales/kg.base";
import tj from "@/i18n/locales/tj.base";
import type { Language, TranslationDictionary } from "@/i18n/types";

const dictionaries: Record<Language, TranslationDictionary> = {
  ru,
  uz,
  uz_cyrl: uzCyrl,
  kz,
  kg,
  tj,
};

const requiredKeys = [
  "bookingAuth.intro",
  "bookingAuth.signingIn",
  "bookingAuth.signingUp",
  "bookingAuth.fullNamePlaceholder",
  "bookingAuth.passwordTooShort",
  "bookingAuth.invalidPhone",
  "bookingAuth.signUpError",
  "bookingAuth.signUpSuccess",
  "booking.promotionApplied",
  "booking.noAvailableServices",
  "booking.withoutService",
] as const;

const manualTimeKeys = [
  "booking.manualTimeHelp",
  "booking.requestedTime",
  "booking.requestedTimePlaceholder",
  "booking.requestReasonLabel",
  "booking.requestReasonPlaceholder",
  "booking.requestReasonRequired",
  "booking.sendRequest",
  "booking.requestSent",
  "booking.requestedFor",
] as const;

function lookup(dictionary: TranslationDictionary, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    return (value as TranslationDictionary)[part];
  }, dictionary);
}

describe("booking localization contract", () => {
  it.each(Object.entries(dictionaries) as [Language, TranslationDictionary][])(
    "defines complete booking copy for %s",
    (language, dictionary) => {
      for (const key of requiredKeys) {
        const value = lookup(dictionary, key);
        expect(value, `${language}:${key}`).toEqual(expect.any(String));
        expect(String(value).trim(), `${language}:${key}`).not.toBe("");
      }
    },
  );

  it("keeps visible BookingAuth copy in translation dictionaries", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/booking/BookingAuth.tsx"),
      "utf8",
    );

    expect(source).toContain("useLanguage");
    expect(source).not.toMatch(/[А-Яа-яЁё]/);
  });

  it.each(["ru", "uz"] as const)(
    "defines native manual-time copy for %s and lets other locales use Russian fallback",
    (language) => {
      for (const key of manualTimeKeys) {
        const value = lookup(dictionaries[language], key);
        expect(value, `${language}:${key}`).toEqual(expect.any(String));
        expect(String(value).trim(), `${language}:${key}`).not.toBe("");
      }
    },
  );

  it("uses shared localized formatters in booking and patient appointments", () => {
    const booking = readFileSync(
      resolve(process.cwd(), "src/components/booking/BookingForm.tsx"),
      "utf8",
    );
    const appointments = readFileSync(
      resolve(process.cwd(), "src/pages/patient/PatientAppointments.tsx"),
      "utf8",
    );

    expect(booking).toContain('from "@/lib/localization"');
    expect(booking).toContain("formatAmount(");
    expect(booking).toContain("formatDate(");
    expect(booking).toContain("formatCaption:");
    expect(booking).not.toContain("Скидка ");
    expect(appointments).toContain('from "@/lib/localization"');
    expect(appointments).not.toContain('from "date-fns"');
  });

  it("keeps manual-time selection filtered and bound to the request contract", () => {
    const booking = readFileSync(
      resolve(process.cwd(), "src/components/booking/BookingForm.tsx"),
      "utf8",
    );

    expect(booking).toContain("getAvailableManualTimeOptions({");
    expect(booking).toContain("durationMinutes: manualDurationMinutes");
    expect(booking).toContain("manualTimeOptions.map((time)");
    expect(booking).toContain("timeRequest: isManualTimeRequest");
    expect(booking).toContain("requestReason: isManualTimeRequest ? requestReason.trim() : null");
    expect(booking).not.toContain("MANUAL_TIME_OPTIONS.map((time)");
  });
});
