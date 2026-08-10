import type { ClinicServiceWriteInput } from "./clinic-service-management-api";

interface CatalogService {
  nameRu: string;
  nameKey: string;
}

interface CatalogCategory {
  categoryRu: string;
  categoryKey: string;
  services: CatalogService[];
}

export const ONBOARDING_SERVICE_CATALOG: CatalogCategory[] = [
  { categoryRu: "Диагностика", categoryKey: "catDiagnostics", services: [
    { nameRu: "Первичный осмотр", nameKey: "svcInitialExam" },
    { nameRu: "Рентгенография", nameKey: "svcXray" },
    { nameRu: "КТ (КЛКТ)", nameKey: "svcCT" },
    { nameRu: "Панорамный снимок", nameKey: "svcPanoramic" },
  ] },
  { categoryRu: "Терапия", categoryKey: "catTherapy", services: [
    { nameRu: "Лечение кариеса", nameKey: "svcCariesTreat" },
    { nameRu: "Лечение пульпита", nameKey: "svcPulpitisTreat" },
    { nameRu: "Пломбирование", nameKey: "svcFilling" },
    { nameRu: "Чистка каналов", nameKey: "svcCanalCleaning" },
  ] },
  { categoryRu: "Хирургия", categoryKey: "catSurgery", services: [
    { nameRu: "Удаление зуба простое", nameKey: "svcSimpleExtraction" },
    { nameRu: "Удаление зуба сложное", nameKey: "svcComplexExtraction" },
    { nameRu: "Удаление зуба мудрости", nameKey: "svcWisdomExtraction" },
    { nameRu: "Имплантация", nameKey: "svcImplant" },
  ] },
  { categoryRu: "Ортодонтия", categoryKey: "catOrthodontics", services: [
    { nameRu: "Брекеты металлические", nameKey: "svcMetalBraces" },
    { nameRu: "Брекеты керамические", nameKey: "svcCeramicBraces" },
    { nameRu: "Элайнеры", nameKey: "svcAligners" },
    { nameRu: "Ретейнеры", nameKey: "svcRetainers" },
  ] },
  { categoryRu: "Гигиена", categoryKey: "catHygiene", services: [
    { nameRu: "Профессиональная чистка", nameKey: "svcProCleaning" },
    { nameRu: "Air Flow", nameKey: "svcAirFlow" },
    { nameRu: "Фторирование", nameKey: "svcFluoridation" },
    { nameRu: "Отбеливание", nameKey: "svcBleaching" },
  ] },
  { categoryRu: "Протезирование", categoryKey: "catProsthetics", services: [
    { nameRu: "Коронка металлокерамика", nameKey: "svcMetalCeramicCrown" },
    { nameRu: "Коронка циркониевая", nameKey: "svcZirconiaCrown" },
    { nameRu: "Виниры", nameKey: "svcVeneers" },
    { nameRu: "Мост", nameKey: "svcBridge" },
  ] },
];

export function localizeOnboardingServiceCatalog(t: (key: string) => string) {
  return ONBOARDING_SERVICE_CATALOG.map((category) => ({
    ...category,
    label: t(`crmStepPriceList.${category.categoryKey}`),
    services: category.services.map((service) => ({
      ...service,
      label: t(`crmStepPriceList.${service.nameKey}`),
    })),
  }));
}

export function buildOnboardingServiceInputs(
  selectedNamesRu: Iterable<string>,
): ClinicServiceWriteInput[] {
  const byName = new Map(ONBOARDING_SERVICE_CATALOG.flatMap((category) =>
    category.services.map((service) => [service.nameRu, category.categoryRu] as const)));

  return Array.from(selectedNamesRu, (nameRu) => ({
    nameRu,
    category: byName.get(nameRu) ?? "Другое",
    price: 0,
    currency: "UZS",
    duration: 30,
    isActive: true,
  }));
}
