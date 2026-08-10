import { expect, test } from "@playwright/test";

const LCP_BUDGET_MS = 2_000;
const CARD_COUNT = 24;
const INLINE_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='225' viewBox='0 0 180 225'%3E%3Crect width='180' height='225' fill='%23e7eceb'/%3E%3C/svg%3E";

function doctor(index: number) {
  const suffix = String(index + 1).padStart(2, "0");
  return {
    id: `53400000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    fullName: `Sprint03 Doctor ${suffix}`,
    avatarUrl: INLINE_AVATAR,
    gender: index % 2 === 0 ? "female" : "male",
    specialty: index % 2 === 0 ? "Терапевт" : "Ортодонт",
    experienceYears: 5 + index,
    priceFrom: 150000 + index * 10000,
    rating: 4.5 + (index % 5) * 0.1,
    reviewCount: 20 + index,
    isVerified: true,
    images: [],
    videoUrl: null,
    latitude: 41.3,
    longitude: 69.2,
    subscriptionPlan: "BASIC",
    clinic: {
      id: "53100000-0000-4000-8000-000000000001",
      name: "Sprint 03 Performance Clinic",
      city: "Tashkent",
      district: "Chilanzar",
      latitude: 41.3,
      longitude: 69.2,
    },
  };
}

const searchPage = {
  content: Array.from({ length: CARD_COUNT }, (_, index) => doctor(index)),
  number: 0,
  size: CARD_COUNT,
  totalElements: 10_000,
  totalPages: Math.ceil(10_000 / CARD_COUNT),
  first: true,
  last: false,
  empty: false,
};

test("search LCP stays within 2000 ms with 24 deterministic cards", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const target = window as Window & {
      __prodentLcp?: { startTime: number; element: string | null };
    };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const lcpEntry = entry as PerformanceEntry & { element?: Element };
        target.__prodentLcp = {
          startTime: entry.startTime,
          element: lcpEntry.element?.tagName || null,
        };
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  let searchRequests = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/public/doctors/search") {
      searchRequests += 1;
      expect(url.searchParams.get("size")).toBe("24");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(searchPage),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: url.pathname.includes("/boosts/") ? "{}" : "[]",
    });
  });

  await page.goto("/search", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("doctor-card")).toHaveCount(CARD_COUNT);

  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) =>
        image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
      ),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  await page.waitForTimeout(250);
  const lcp = await page.evaluate(
    () =>
      (
        window as Window & {
          __prodentLcp?: { startTime: number; element: string | null };
        }
      ).__prodentLcp,
  );

  await testInfo.attach("search-lcp.json", {
    body: JSON.stringify({ lcp, budgetMs: LCP_BUDGET_MS, cards: CARD_COUNT }, null, 2),
    contentType: "application/json",
  });

  expect(searchRequests).toBe(1);
  expect(lcp, "The browser did not report an LCP entry").toBeDefined();
  expect(lcp!.startTime).toBeGreaterThan(0);
  expect(lcp!.startTime).toBeLessThanOrEqual(LCP_BUDGET_MS);
});
