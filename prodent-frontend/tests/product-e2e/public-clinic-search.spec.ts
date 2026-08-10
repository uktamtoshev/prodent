import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  CLINIC_SEARCH_PAGE_SIZE,
  PUBLIC_CLINIC_SEARCH_PATH,
  fulfillClinicFallbackApi,
  fulfillClinicJson,
  makePublicClinicSearchPage,
  preparePublicClinicPage,
} from "./fixtures/public-clinic-search";

const DEEP_LINK =
  "/clinics?q=Smile%20%26%20Care&city=tashkent&district=Chilanzar" +
  "&sort=rating&view=list&page=2";

const EXPECTED_URL_STATE = {
  q: "Smile & Care",
  city: "tashkent",
  district: "Chilanzar",
  sort: "rating",
  view: "list",
  page: "2",
} as const;

async function expectClinicUrlState(urlValue: string): Promise<void> {
  const url = new URL(urlValue);
  expect(url.pathname).toBe("/clinics");
  for (const [key, value] of Object.entries(EXPECTED_URL_STATE)) {
    expect(url.searchParams.get(key), `URL parameter "${key}"`).toBe(value);
  }
}

test.beforeEach(async ({ page }) => {
  await preparePublicClinicPage(page);
});

test("deep link maps to the bounded API request and Back keeps its state", async ({
  page,
}) => {
  const searchRequests: URL[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_CLINIC_SEARCH_PATH) {
      searchRequests.push(url);
      await fulfillClinicJson(
        route,
        makePublicClinicSearchPage(Number(url.searchParams.get("page") || 0)),
      );
      return;
    }
    await fulfillClinicFallbackApi(route);
  });

  await page.goto(DEEP_LINK, { waitUntil: "domcontentloaded" });
  const cards = page.locator("main article");
  await expect(cards).toHaveCount(CLINIC_SEARCH_PAGE_SIZE);
  expect(await cards.count()).toBeLessThanOrEqual(CLINIC_SEARCH_PAGE_SIZE);

  await expect.poll(() => searchRequests.length).toBeGreaterThan(0);
  const apiUrl = searchRequests[0];
  expect(apiUrl.searchParams.get("query")).toBe("Smile & Care");
  expect(apiUrl.searchParams.get("city")).toBe("tashkent");
  expect(apiUrl.searchParams.get("district")).toBe("Chilanzar");
  expect(apiUrl.searchParams.get("sort")).toBe("rating");
  expect(apiUrl.searchParams.get("page")).toBe("2");
  expect(apiUrl.searchParams.get("size")).toBe(String(CLINIC_SEARCH_PAGE_SIZE));
  expect(apiUrl.searchParams.get("verified")).toBeNull();
  expect(apiUrl.searchParams.get("view")).toBeNull();

  const profileLink = cards.first().locator('a[href^="/clinic/"]').first();
  const profilePath = await profileLink.getAttribute("href");
  expect(profilePath).toMatch(/^\/clinic\/[0-9a-f-]+$/);
  await profileLink.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(profilePath);

  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectClinicUrlState(page.url());
  await expect(cards).toHaveCount(CLINIC_SEARCH_PAGE_SIZE);
});

test("empty response shows the empty state without clinic cards", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_CLINIC_SEARCH_PATH) {
      await fulfillClinicJson(route, makePublicClinicSearchPage(0, 0, 0));
      return;
    }
    await fulfillClinicFallbackApi(route);
  });

  await page.goto("/clinics?q=no-match", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await expect(page.locator("main article")).toHaveCount(0);
});

test("failed request exposes Retry and recovers", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_CLINIC_SEARCH_PATH) {
      attempts += 1;
      if (attempts <= 2) {
        await fulfillClinicJson(route, { message: "temporary failure" }, 503);
      } else {
        await fulfillClinicJson(route, makePublicClinicSearchPage(0, 1, 1));
      }
      return;
    }
    await fulfillClinicFallbackApi(route);
  });

  await page.goto("/clinics", { waitUntil: "domcontentloaded" });
  const errorState = page.locator("main [role=alert]");
  await expect(errorState).toBeVisible();
  await errorState.getByRole("button", { name: "Повторить" }).click();

  await expect(page.locator("main article")).toHaveCount(1);
  expect(attempts).toBe(3);
});

test("map open and close are reflected in the URL without losing filters", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_CLINIC_SEARCH_PATH) {
      await fulfillClinicJson(route, makePublicClinicSearchPage(2));
      return;
    }
    await fulfillClinicFallbackApi(route);
  });
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());

  await page.goto(DEEP_LINK, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main article")).toHaveCount(CLINIC_SEARCH_PAGE_SIZE);
  await page.getByRole("button", { name: "На карте", exact: true }).first().click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("map");
  const openUrl = new URL(page.url());
  expect(openUrl.searchParams.get("q")).toBe(EXPECTED_URL_STATE.q);
  expect(openUrl.searchParams.get("page")).toBe(EXPECTED_URL_STATE.page);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBeNull();
  const closedUrl = new URL(page.url());
  expect(closedUrl.searchParams.get("q")).toBe(EXPECTED_URL_STATE.q);
  expect(closedUrl.searchParams.get("page")).toBe(EXPECTED_URL_STATE.page);
});

test("24-card results fit the viewport and have no critical axe violations", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PUBLIC_CLINIC_SEARCH_PATH) {
      await fulfillClinicJson(route, makePublicClinicSearchPage());
      return;
    }
    await fulfillClinicFallbackApi(route);
  });

  await page.goto("/clinics", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main article")).toHaveCount(CLINIC_SEARCH_PAGE_SIZE);

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
