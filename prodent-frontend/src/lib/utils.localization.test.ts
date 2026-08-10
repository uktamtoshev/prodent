import { afterAll, describe, expect, it } from "vitest";

import { languageRuntime } from "@/i18n/language-runtime";
import { formatAmount } from "@/lib/localization";
import { formatPrice, formatPriceFrom } from "@/lib/utils";

describe("shared price formatting", () => {
  afterAll(async () => {
    await languageRuntime.switchLanguage("ru");
  });

  it.each(["ru", "uz", "uz_cyrl", "kz", "kg", "tj"] as const)(
    "uses the selected %s locale",
    async (language) => {
      await languageRuntime.switchLanguage(language);
      const localizedAmount = formatAmount(1_234_567, language);

      expect(formatPrice(1_234_567, "UZS", false)).toBe(`${localizedAmount} UZS`);
      expect(formatPriceFrom(1_234_567, "UZS")).toContain(localizedAmount);
    },
  );
});
