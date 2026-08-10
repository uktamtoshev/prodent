import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = ["/", "/search", "/clinics", "/articles", "/auth"] as const;
const TOUCH_TARGET_ROUTES = ["/", "/auth"] as const;
const TOUCH_TARGET_MIN_PX = 44;
const TOUCH_TARGET_EPSILON_PX = 0.1;

async function prepareStableA11yPage(page: import("@playwright/test").Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
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
  await expect(page.locator("#root")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
}

for (const route of PUBLIC_ROUTES) {
  test(`${route} meets WCAG 2.2 AA`, async ({ page }) => {
    await prepareStableA11yPage(page, route);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(
      results.violations,
      JSON.stringify(
        results.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.map((node) => node.target),
        })),
        null,
        2,
      ),
    ).toEqual([]);
  });

  test(`${route} fits the viewport`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
  });
}

test("public navigation is keyboard reachable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const skipLink = page.locator('a[href="#main-content"]');
  await expect(skipLink).toBeAttached();
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
});

for (const route of TOUCH_TARGET_ROUTES) {
  test(`${route} keeps visible links and buttons at least 44px wide and high`, async ({
    page,
  }) => {
    await prepareStableA11yPage(page, route);

    const undersized = await page
      .locator(
        'a:visible:not([href="#main-content"]), button:visible:not([role="checkbox"])',
      )
      .evaluateAll(
        (elements, minimumSize) =>
          elements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              label:
                element.getAttribute("aria-label") ||
                element.textContent?.trim().slice(0, 80) ||
                element.tagName,
            };
          })
          .filter(({ width, height }) => width < minimumSize || height < minimumSize),
        TOUCH_TARGET_MIN_PX - TOUCH_TARGET_EPSILON_PX,
      );

    expect(undersized).toEqual([]);
  });
}

test("mobile public menu close control is at least 44px wide and high", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Mobile navigation only");
  await prepareStableA11yPage(page, "/auth");

  await page.locator("button:visible").filter({ has: page.locator("svg.lucide-menu") }).click();
  const closeButton = page.getByRole("dialog").getByRole("button").first();
  await expect(closeButton).toBeVisible();

  const box = await closeButton.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN_PX - TOUCH_TARGET_EPSILON_PX);
  expect(box!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN_PX - TOUCH_TARGET_EPSILON_PX);
});
