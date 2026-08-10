import { describe, expect, it } from "vitest";

import {
  buildOnboardingServiceInputs,
  localizeOnboardingServiceCatalog,
} from "./onboarding-service-catalog";

describe("onboarding service catalog", () => {
  it("keeps Russian canonical payload when the visible locale is not Russian", () => {
    const localized = localizeOnboardingServiceCatalog((key) => `UZ:${key}`);
    const visibleService = localized[0].services[0];

    expect(visibleService.label).toBe("UZ:crmStepPriceList.svcInitialExam");
    expect(buildOnboardingServiceInputs([visibleService.nameRu])).toEqual([{
      nameRu: "Первичный осмотр",
      category: "Диагностика",
      price: 0,
      currency: "UZS",
      duration: 30,
      isActive: true,
    }]);
  });
});
