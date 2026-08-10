import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  PUBLIC_DOCTOR_SEARCH_PATH,
  SEARCH_CARD_LIMIT,
  fulfillJson,
  fulfillNonSearchApi,
  makePublicDoctorSearchPage,
  preparePublicSearchPage,
} from "./fixtures/public-doctor-search";

const DEEP_LINK =
  "/search?q=Aziza%20%26%20Co&specialty=orthodontist&city=Tashkent" +
  "&district=Chilanzar&minPrice=150000&maxPrice=400000&rating=4.5" +
  "&video=1&sort=price-asc&view=list&page=3";

const EXPECTED_DEEP_LINK_STATE = {
  q: "Aziza & Co",
  specialty: "orthodontist",
  city: "Tashkent",
  district: "Chilanzar",
  minPrice: "150000",
  maxPrice: "400000",
  rating: "4.5",
  video: "1",
  sort: "price-asc",
  view: "list",
  page: "3",
} as const;

async function expectDeepLinkState(urlValue: string): Promise<void> {
  const url = new URL(urlValue);
  expect(url.pathname).toBe("/search");
  for (const [key, value] of Object.entries(EXPECTED_DEEP_LINK_STATE)) {
    expect(url.searchParams.get(key), `URL parameter "${key}"`).toBe(value);
  }
}

test.beforeEach(async ({ page }) => {
  await preparePublicSearchPage(page);
});

test("deep link maps to the bounded API request and Back keeps its state", async ({
  page,
}) => {
  const searchRequests: URL[] = [];

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_DOCTOR_SEARCH_PATH) {
      searchRequests.push(url);
      await fulfillJson(
        route,
        makePublicDoctorSearchPage({
          page: Number(url.searchParams.get("page") || 0),
          count: SEARCH_CARD_LIMIT,
          totalElements: 240,
        }),
      );
      return;
    }
    await fulfillNonSearchApi(route);
  });

  await page.goto(DEEP_LINK, { waitUntil: "domcontentloaded" });
  const cards = page.getByTestId("doctor-card");
  await expect(cards).toHaveCount(SEARCH_CARD_LIMIT);
  expect(await cards.count()).toBeLessThanOrEqual(SEARCH_CARD_LIMIT);

  await expect.poll(() => searchRequests.length).toBeGreaterThan(0);
  const apiUrl = searchRequests[0];
  expect(apiUrl.searchParams.get("query")).toBe("Aziza & Co");
  expect(apiUrl.searchParams.get("specialty")).toBe("orthodontist");
  expect(apiUrl.searchParams.get("city")).toBe("Tashkent");
  expect(apiUrl.searchParams.get("district")).toBe("Chilanzar");
  expect(apiUrl.searchParams.get("minPrice")).toBe("150000");
  expect(apiUrl.searchParams.get("maxPrice")).toBe("400000");
  expect(apiUrl.searchParams.get("rating")).toBe("4.5");
  expect(apiUrl.searchParams.get("video")).toBe("true");
  expect(apiUrl.searchParams.get("sort")).toBe("price-asc");
  expect(apiUrl.searchParams.get("page")).toBe("3");
  expect(apiUrl.searchParams.get("size")).toBe(String(SEARCH_CARD_LIMIT));

  const firstProfileLink = cards.first().locator('a[href^="/doctor/"]').first();
  const firstProfilePath = await firstProfileLink.getAttribute("href");
  expect(firstProfilePath).toMatch(/^\/doctor\/[0-9a-f-]+$/);
  await firstProfileLink.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(firstProfilePath);

  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectDeepLinkState(page.url());
  await expect(cards).toHaveCount(SEARCH_CARD_LIMIT);
});

test("empty response shows the empty state without doctor cards", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_DOCTOR_SEARCH_PATH) {
      await fulfillJson(route, makePublicDoctorSearchPage({ count: 0, totalElements: 0 }));
      return;
    }
    await fulfillNonSearchApi(route);
  });

  await page.goto("/search?q=no-match", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await expect(page.locator('main a[href^="/doctor/"]')).toHaveCount(0);
});

test("never invents availability or booking for a doctor without a clinic", async ({
  page,
}) => {
  const response = makePublicDoctorSearchPage({ count: 1, totalElements: 1 });
  response.content[0].clinic = null;

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_DOCTOR_SEARCH_PATH) {
      await fulfillJson(route, response);
      return;
    }
    await fulfillNonSearchApi(route);
  });

  await page.goto("/search", { waitUntil: "domcontentloaded" });
  const card = page.getByTestId("doctor-card");
  await expect(card).toHaveCount(1);
  await expect(card.locator('a[href^="/book/"]')).toHaveCount(0);
  await expect(card.getByText("16:00", { exact: true })).toHaveCount(0);
  await expect(card.getByText("+12", { exact: true })).toHaveCount(0);
  await expect(card.getByText("98%", { exact: true })).toHaveCount(0);
});

test("failed request exposes Retry and recovers", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_DOCTOR_SEARCH_PATH) {
      attempts += 1;
      if (attempts <= 2) {
        await fulfillJson(route, { message: "temporary failure" }, 503);
      } else {
        await fulfillJson(route, makePublicDoctorSearchPage({ count: 1, totalElements: 1 }));
      }
      return;
    }
    await fulfillNonSearchApi(route);
  });

  await page.goto("/search", { waitUntil: "domcontentloaded" });
  const errorState = page.locator("main [role=alert]");
  await expect(errorState).toBeVisible();
  await errorState.getByRole("button", { name: "Повторить" }).click();

  await expect(page.getByTestId("doctor-card")).toHaveCount(1);
  expect(attempts).toBe(3);
});

test("24-card results fit the viewport and have no critical axe violations", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_DOCTOR_SEARCH_PATH) {
      await fulfillJson(route, makePublicDoctorSearchPage());
      return;
    }
    await fulfillNonSearchApi(route);
  });

  await page.goto("/search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("doctor-card")).toHaveCount(SEARCH_CARD_LIMIT);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);

  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const criticalViolations = result.violations.filter(
    (violation) => violation.impact === "critical",
  );

  expect(
    criticalViolations,
    JSON.stringify(
      criticalViolations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
      null,
      2,
    ),
  ).toEqual([]);
});
