import type { Page, Route } from "@playwright/test";

export const PUBLIC_DOCTOR_SEARCH_PATH = "/api/v1/public/doctors/search";
export const SEARCH_CARD_LIMIT = 24;

const INLINE_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='225'%3E%3Crect width='180' height='225' fill='%23e7eceb'/%3E%3C/svg%3E";

export interface SearchResponseOptions {
  page?: number;
  count?: number;
  totalElements?: number;
}

export function makePublicDoctor(index: number) {
  const number = index + 1;
  return {
    id: `63400000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    fullName: `Acceptance Doctor ${String(number).padStart(2, "0")}`,
    avatarUrl: INLINE_AVATAR,
    gender: number % 2 === 0 ? "female" : "male",
    specialty: number % 2 === 0 ? "Ортодонт" : "Терапевт",
    experienceYears: 4 + number,
    priceFrom: 120000 + number * 10000,
    rating: 4.5 + (number % 5) * 0.1,
    reviewCount: 10 + number,
    isVerified: true,
    images: [],
    videoUrl: number % 3 === 0 ? "https://media.prodent.test/intro.mp4" : null,
    latitude: 41.3,
    longitude: 69.2,
    subscriptionPlan: "BASIC",
    clinic: {
      id: "63100000-0000-4000-8000-000000000001",
      name: "Acceptance Clinic",
      city: "Tashkent",
      district: "Chilanzar",
      latitude: 41.3,
      longitude: 69.2,
    },
  };
}

export function makePublicDoctorSearchPage({
  page = 0,
  count = SEARCH_CARD_LIMIT,
  totalElements = 120,
}: SearchResponseOptions = {}) {
  const boundedCount = Math.min(Math.max(0, count), SEARCH_CARD_LIMIT);
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / SEARCH_CARD_LIMIT);

  return {
    content: Array.from({ length: boundedCount }, (_, index) =>
      makePublicDoctor(page * SEARCH_CARD_LIMIT + index),
    ),
    number: page,
    size: SEARCH_CARD_LIMIT,
    totalElements,
    totalPages,
    first: page === 0,
    last: totalPages === 0 || page >= totalPages - 1,
    empty: boundedCount === 0,
  };
}

export async function preparePublicSearchPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("language", "ru");
    localStorage.setItem("theme", "light");
  });
}

export async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function fulfillNonSearchApi(route: Route): Promise<void> {
  const pathname = new URL(route.request().url()).pathname;
  await fulfillJson(route, pathname.includes("/boosts/") ? {} : []);
}
