import type { Page, Route } from "@playwright/test";

export const PUBLIC_CLINIC_SEARCH_PATH = "/api/v1/public/clinics/search";
export const CLINIC_SEARCH_PAGE_SIZE = 24;

export function makePublicClinic(index: number) {
  const number = index + 1;
  return {
    id: `73100000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    name: `Acceptance Clinic ${String(number).padStart(2, "0")}`,
    city: "Tashkent",
    district: "Chilanzar",
    address: "Acceptance address",
    phone: "+998712000000",
    email: "public-clinic@fixture.prodent.test",
    website: "https://fixture.prodent.test",
    description: "Deterministic public clinic search fixture",
    isVerified: true,
    logoUrl: null,
    coverUrl: null,
    latitude: 41.3,
    longitude: 69.2,
    subscriptionPlan: "BASIC",
    rating: 4.8,
    reviewCount: 20 + number,
    workingHours: { open: "09:00", close: "18:00" },
    doctorCount: 3 + (number % 8),
  };
}

export function makePublicClinicSearchPage(
  page = 0,
  count = CLINIC_SEARCH_PAGE_SIZE,
  totalElements = 96,
) {
  const boundedCount = Math.min(Math.max(0, count), CLINIC_SEARCH_PAGE_SIZE);
  const totalPages =
    totalElements === 0 ? 0 : Math.ceil(totalElements / CLINIC_SEARCH_PAGE_SIZE);
  return {
    content: Array.from({ length: boundedCount }, (_, index) =>
      makePublicClinic(page * CLINIC_SEARCH_PAGE_SIZE + index),
    ),
    number: page,
    size: CLINIC_SEARCH_PAGE_SIZE,
    totalElements,
    totalPages,
    first: page === 0,
    last: totalPages === 0 || page >= totalPages - 1,
    empty: boundedCount === 0,
  };
}

export async function preparePublicClinicPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("language", "ru");
    localStorage.setItem("theme", "light");
  });
}

export async function fulfillClinicJson(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function fulfillClinicFallbackApi(route: Route): Promise<void> {
  await fulfillClinicJson(route, []);
}
