import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function disableMotion(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 1ms !important;
        animation-delay: 0ms !important;
        transition-duration: 1ms !important;
        transition-delay: 0ms !important;
        scroll-behavior: auto !important;
      }
    `,
  });
}

async function mockPublicStats(page: Page) {
  await page.route("**/api/v1/data/doctors**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("select")?.replace(/\s/g, "") === "rating,reviews_count") {
      await route.fulfill({
        json: [
          { rating: 4.6, reviews_count: 5 },
          { rating: 5, reviews_count: 3 },
        ],
      });
      return;
    }

    await route.fulfill({
      json: [{ id: "doctor-fixture" }],
      headers: { "content-range": "0-0/27" },
    });
  });
  await page.route("**/api/v1/data/clinics**", async (route) => {
    await route.fulfill({
      json: [{ id: "clinic-fixture" }],
      headers: { "content-range": "0-0/8" },
    });
  });
}

async function openStablePublicHome(
  page: Page,
  theme: "light" | "dark" = "light",
  options: { mockStats?: boolean } = {},
) {
  if (options.mockStats !== false) await mockPublicStats(page);
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("theme", selectedTheme);
    // Pin the language for the same reason the theme is pinned. With no stored
    // language LanguageContext renders "ru" and then races an async call to the
    // third-party ipapi.co lookup, switching to "uz" if the caller looks Uzbek.
    // The screenshot catches whichever side of that race won, so the page came
    // out Russian on the CI runner and Uzbek from an Uzbek IP — a ~5% pixel diff
    // that no baseline can satisfy in both places. A stored language makes
    // getInitialLanguage return immediately and skips the geo lookup entirely.
    localStorage.setItem("language", "uz");
  }, theme);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await disableMotion(page);
  await expect(page.locator("#root")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass(new RegExp(theme));
}

test.describe("Sprint 2 public reference", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`home meets WCAG accessibility checks in ${theme} theme`, async ({ page }) => {
      await openStablePublicHome(page, theme);

      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      expect(
        result.violations,
        JSON.stringify(
          result.violations.map(({ id, impact, nodes }) => ({
            id,
            impact,
            targets: nodes.map((node) => node.target),
          })),
          null,
          2,
        ),
      ).toEqual([]);
    });

    test(`home ${theme} visual baseline`, async ({ page }, testInfo) => {
      test.skip(
        process.platform !== "linux",
        "The canonical baseline is generated only by Chromium on Linux CI.",
      );

      await openStablePublicHome(page, theme);
      await expect(page).toHaveScreenshot(`public-home-${theme}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: false,
        maxDiffPixelRatio: 0.02,
      });

      expect(testInfo.project.name).toMatch(/^(desktop|mobile)-chromium$/);
    });
  }

  test("home starts keyboard navigation with the skip link", async ({ page }) => {
    await openStablePublicHome(page);

    const skipLink = page.locator('a[href="#main-content"]');
    await page.keyboard.press("Tab");

    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
  });

  test("live stats use stable loading and real-data states without dash placeholders", async ({ page }) => {
    let releaseStats: (() => void) | undefined;
    const statsGate = new Promise<void>((resolve) => {
      releaseStats = resolve;
    });

    await page.route("**/api/v1/data/doctors**", async (route) => {
      await statsGate;
      const url = new URL(route.request().url());
      if (url.searchParams.get("select")?.replace(/\s/g, "") === "rating,reviews_count") {
        await route.fulfill({
          json: [
            { rating: 4.6, reviews_count: 5 },
            { rating: 5, reviews_count: 3 },
          ],
        });
        return;
      }
      await route.fulfill({
        json: [{ id: "doctor-fixture" }],
        headers: { "content-range": "0-0/27" },
      });
    });
    await page.route("**/api/v1/data/clinics**", async (route) => {
      await statsGate;
      await route.fulfill({
        json: [{ id: "clinic-fixture" }],
        headers: { "content-range": "0-0/8" },
      });
    });

    await openStablePublicHome(page, "light", { mockStats: false });

    const stats = page.getByTestId("public-live-stats");
    await expect(stats).toHaveAttribute("aria-busy", "true");
    await expect(page.getByTestId("public-live-stat-skeleton")).toHaveCount(3);
    await expect(stats).not.toContainText("—");
    const loadingBox = await stats.boundingBox();

    releaseStats?.();

    await expect(stats).toHaveAttribute("aria-busy", "false");
    await expect(stats).toContainText("27");
    await expect(stats).toContainText("4.8");
    await expect(stats).toContainText("8");
    await expect(stats).not.toContainText("—");
    await expect(page.getByTestId("public-live-stat-skeleton")).toHaveCount(0);

    const readyBox = await stats.boundingBox();
    expect(loadingBox).not.toBeNull();
    expect(readyBox).not.toBeNull();
    expect(Math.abs((readyBox?.height ?? 0) - (loadingBox?.height ?? 0))).toBeLessThanOrEqual(1);
  });

  test("live stats expose an accessible unavailable state without fake values", async ({ page }) => {
    await page.route("**/api/v1/data/doctors**", (route) =>
      route.fulfill({ status: 503, json: { message: "Unavailable" } }),
    );
    await page.route("**/api/v1/data/clinics**", (route) =>
      route.fulfill({ status: 503, json: { message: "Unavailable" } }),
    );

    await openStablePublicHome(page, "light", { mockStats: false });

    const stats = page.getByTestId("public-live-stats");
    await expect(stats).toHaveAttribute("aria-busy", "false");
    await expect(stats).not.toContainText("—");
    await expect(stats.locator(".text-3xl")).toHaveCount(0);
    await expect(stats.locator(".sr-only")).not.toBeEmpty();
  });

  test("landing header controls have touch targets and the theme control works", async ({ page }) => {
    await openStablePublicHome(page);

    const controls = page.getByTestId("landing-header-actions").getByRole("button");
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let index = 0; index < count; index += 1) {
      const box = await controls.nth(index).boundingBox();
      expect(box, `header control ${index + 1} is visible`).not.toBeNull();
      expect(box?.width ?? 0, `header control ${index + 1} width`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `header control ${index + 1} height`).toBeGreaterThanOrEqual(44);
    }

    const homeLink = page.locator('header a[href="/"]').first();
    const homeLinkBox = await homeLink.boundingBox();
    expect(homeLinkBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(homeLinkBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const themeButton = page.getByRole("button", { name: /тему/i });
    await themeButton.click();
    await page.getByRole("menuitem").nth(1).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("Sprint 2 CRM guest contract", () => {
  test("guest is redirected without rendering the clinical cabinet", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("prodent_access_token");
      localStorage.removeItem("prodent_refresh_token");
      localStorage.removeItem("prodent_user_profile");
      sessionStorage.clear();
    });

    await page.goto("/crm", { waitUntil: "domcontentloaded" });

    await expect.poll(() => new URL(page.url()).pathname).toBe("/auth");
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.locator('[data-testid="crm-dashboard"]')).toHaveCount(0);
  });
});
