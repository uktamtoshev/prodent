import { expect, test } from "@playwright/test";

const PROTECTED_ROUTE_CASES = [
  {
    route: "/crm",
    expectedPath: /\/auth$/,
  },
  {
    route: "/doctor/calendar",
    expectedPath: /\/auth$/,
  },
  {
    route: "/patient",
    expectedPath: /\/auth$/,
  },
  {
    route: "/admin",
    expectedPath: /\/auth$/,
  },
  {
    route: "/seller/orders",
    expectedPath: /^\/$/,
  },
] as const;

test.describe("protected route access", () => {
  for (const { route, expectedPath } of PROTECTED_ROUTE_CASES) {
    test(`${route} does not expose the cabinet to guests`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto(route, { waitUntil: "domcontentloaded" });

      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
        .toMatch(expectedPath);
      expect(new URL(page.url()).pathname).not.toBe(route);
      await expect(page.locator("#root")).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }
});
