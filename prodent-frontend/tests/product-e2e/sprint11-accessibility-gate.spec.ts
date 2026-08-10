import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import {
  BOOKING_DOCTOR_ID,
  preparePublicBooking,
} from "./fixtures/public-booking";

const VIEWPORT_WIDTHS = [360, 768, 1024, 1440] as const;
const REPRESENTATIVE_ROUTES = ["/", "/search", "/auth", "/jobs"] as const;
const JOBS_USER_ID = "00000000-0000-4000-8000-000000000711";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function prepareRoute(page: Page, route: string) {
  await page.addInitScript(({ authenticated, userId }) => {
    localStorage.setItem("language", "ru");
    if (!authenticated) {
      localStorage.removeItem("prodent_access_token");
      localStorage.removeItem("prodent_refresh_token");
      localStorage.removeItem("prodent_user_profile");
      return;
    }

    const encode = (value: object) =>
      btoa(JSON.stringify(value))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
    const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      sub: userId,
      email: "sprint11.jobs@prodent.test",
      roles: ["doctor"],
    })}.test-signature`;
    localStorage.setItem("prodent_access_token", token);
    localStorage.setItem(
      "prodent_user_profile",
      JSON.stringify({
        id: userId,
        email: "sprint11.jobs@prodent.test",
        firstName: "Sprint",
        lastName: "Eleven",
        roles: ["doctor"],
      }),
    );
  }, { authenticated: route === "/jobs", userId: JOBS_USER_ID });

  await page.route("**/api/v1/**", async (intercepted) => {
    const path = new URL(intercepted.request().url()).pathname;
    if (path === "/api/v1/data/user_roles") {
      return json(intercepted, [{ role: "doctor" }]);
    }
    if (path === "/api/v1/data/doctors") {
      return json(intercepted, []);
    }
    if (path === "/api/v1/jobs/listings") {
      return json(intercepted, [
        {
          id: "sprint11-listing",
          listing_type: "vacancy",
          category: "dentist",
          title: "Стоматолог-ортодонт",
          clinic_name: "Клиника Sprint 11",
          city: "Ташкент",
          employment_type: "full_time",
          salary_min: 10_000_000,
          salary_max: 20_000_000,
          currency: "UZS",
          salary_mode: "range",
        },
      ]);
    }
    return json(intercepted, []);
  });

  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content")).toBeVisible();
  if (route === "/jobs") {
    await expect(page.getByRole("link", { name: /Стоматолог-ортодонт/i })).toBeVisible();
  } else if (route === "/auth") {
    await expect(page.getByTestId("auth-login-identifier")).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
}

test.describe("Sprint 11 representative route matrix", () => {
  test.skip(({ isMobile }) => isMobile, "The matrix controls all four viewport widths itself.");

  for (const route of REPRESENTATIVE_ROUTES) {
    for (const width of VIEWPORT_WIDTHS) {
      test(`${route} at ${width}px has no serious accessibility or reflow failure`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await prepareRoute(page, route);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        const releaseBlockingViolations = results.violations
          .filter(({ impact }) => impact === "critical" || impact === "serious")
          .map(({ id, impact, nodes }) => ({
            id,
            impact,
            targets: nodes.map(({ target }) => target),
          }));

        expect(releaseBlockingViolations).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true);
      });
    }
  }
});

test.describe("Sprint 11 interaction and resilient-form gates", () => {
  test.skip(({ isMobile }) => isMobile, "These checks run once and set their own viewport.");

  for (const route of REPRESENTATIVE_ROUTES) {
    test(`${route} keeps keyboard skip navigation and reduced motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1024, height: 900 });
      await prepareRoute(page, route);

      await page.keyboard.press("Tab");
      const skipLink = page.locator('a[href="#main-content"]');
      await expect(skipLink).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("#main-content")).toBeFocused();

      const motionProblems = await page.evaluate(() => {
        const milliseconds = (value: string) =>
          value
            .split(",")
            .map((part) => part.trim())
            .map((part) => (part.endsWith("ms") ? parseFloat(part) : parseFloat(part) * 1000));
        return Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .map((element) => {
            const style = getComputedStyle(element);
            return {
              element: element.tagName.toLowerCase(),
              animation: Math.max(...milliseconds(style.animationDuration)),
              transition: Math.max(...milliseconds(style.transitionDuration)),
              iterations: style.animationIterationCount,
            };
          })
          .filter(
            ({ animation, transition, iterations }) =>
              animation > 1 || transition > 1 || iterations.includes("infinite"),
          )
          .slice(0, 20);
      });
      expect(motionProblems).toEqual([]);
    });

    test(`${route} reflows at 200% text on a 360px viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 900 });
      await prepareRoute(page, route);
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

      await expect
        .poll(() =>
          page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth;
            const overflowing = Array.from(document.querySelectorAll<HTMLElement>("body *"))
              .map((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                  element: element.tagName.toLowerCase(),
                  id: element.id,
                  classes: Array.from(element.classList).slice(0, 4),
                  text: (element.innerText || element.textContent || "").trim().slice(0, 80),
                  href: element instanceof HTMLAnchorElement ? element.getAttribute("href") : null,
                  left: Math.round(bounds.left),
                  right: Math.round(bounds.right),
                };
              })
              .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
              .slice(0, 20);
            return document.documentElement.scrollWidth <= viewportWidth ? [] : overflowing;
          }),
        )
        .toEqual([]);
    });
  }

  test("mobile navigation closes on Escape and returns focus", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await prepareRoute(page, "/");

    const menuTrigger = page
      .locator("header")
      .getByRole("button", { name: /Меню|nav\.menu/i });
    await expect(menuTrigger).toBeVisible();
    await menuTrigger.click();
    const mobileMenu = page.getByRole("menu", { name: /Меню|nav\.menu/i });
    await expect(mobileMenu).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(mobileMenu).toHaveCount(0);
    await expect(menuTrigger).toBeFocused();
  });

  test("booking draft survives an offline edit and remount", async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await preparePublicBooking(page);
    await page.goto(`/book/${BOOKING_DOCTOR_ID}`, { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /Консультация/ }).click();
    await page.getByRole("grid").locator("button:not([disabled])").first().click();
    await page.getByRole("button", { name: "09:15", exact: true }).click();

    await context.setOffline(true);
    const offlineBanner = page
      .getByRole("status")
      .filter({ hasText: /Нет сети|черновик|offline/i });
    await expect(offlineBanner).toBeVisible();
    await expect
      .soft(offlineBanner, "The offline banner must not expose a translation key.")
      .not.toContainText("patientCabinet.");
    await page.locator("#notes").fill("Не потерять офлайн-заметку");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem(
            "prodent_patient_draft:booking:patient-acceptance",
          );
          return raw ? JSON.parse(raw).notes : null;
        }),
      )
      .toBe("Не потерять офлайн-заметку");

    await context.setOffline(false);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#notes")).toHaveValue(
      "Не потерять офлайн-заметку",
    );
  });
});
