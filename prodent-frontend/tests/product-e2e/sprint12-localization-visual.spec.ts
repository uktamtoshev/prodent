import { expect, test, type Page, type Route } from "@playwright/test";
import {
  BOOKING_DOCTOR_ID,
  preparePublicBooking,
} from "./fixtures/public-booking";

const LANGUAGES = ["ru", "uz", "uz_cyrl", "kz", "kg", "tj"] as const;
const PUBLIC_ROUTES = ["/", "/search", "/auth"] as const;
const HTML_LOCALES: Record<(typeof LANGUAGES)[number], string> = {
  ru: "ru-RU",
  uz: "uz-Latn-UZ",
  uz_cyrl: "uz-Cyrl-UZ",
  kz: "kk-KZ",
  kg: "ky-KG",
  tj: "tg-TJ",
};
const RAW_TRANSLATION_KEY =
  /\b(?:auth|booking|common|footer|landing|nav|patientCabinet|search)\.[A-Za-z][A-Za-z0-9_.-]*/;

async function json(route: Route, body: unknown) {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockPublicReads(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    await json(route, []);
  });
  await page.route("https://ipapi.co/**", (route) => route.abort());
}

async function setLanguageAndTheme(
  page: Page,
  language: (typeof LANGUAGES)[number],
  theme: "light" | "dark" = "light",
) {
  await page.addInitScript(
    ({ selectedLanguage, selectedTheme }) => {
      localStorage.removeItem("prodent_access_token");
      localStorage.removeItem("prodent_refresh_token");
      localStorage.removeItem("prodent_user_profile");
      localStorage.setItem("language", selectedLanguage);
      localStorage.setItem("theme", selectedTheme);
      sessionStorage.clear();
    },
    { selectedLanguage: language, selectedTheme: theme },
  );
}

async function waitForStablePublicPage(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await page.locator("#main-content").isVisible().catch(() => false)) break;
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await expect(page.locator("#main-content")).toBeVisible();
  if (route === "/auth") {
    await expect(page.getByTestId("auth-login-identifier")).toBeVisible();
  }
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
  await page.evaluate(() => document.fonts.ready);
}

async function visibleClippedControls(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "main h1, main h2, main label, main button, main a",
      ),
    )
      .filter((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          bounds.width > 0 &&
          bounds.height > 0 &&
          (element.scrollWidth > element.clientWidth + 1 ||
            bounds.left < -1 ||
            bounds.right > document.documentElement.clientWidth + 1)
        );
      })
      .map((element) => ({
        element: element.tagName.toLowerCase(),
        text: element.innerText.trim().slice(0, 100),
        classes: Array.from(element.classList).slice(0, 5),
      }))
      .slice(0, 20),
  );
}

async function horizontalOverflowDetails(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= viewportWidth) return [];
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .reverse()
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          element: element.tagName.toLowerCase(),
          text: (element.textContent || "").trim().slice(0, 100),
          classes: Array.from(element.classList).slice(0, 5),
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      })
      .filter(
        ({ left, right, clientWidth, scrollWidth }) =>
          left < -1 || right > viewportWidth + 1 || scrollWidth > clientWidth + 1,
      )
      .slice(0, 20);
  });
}

test.describe("Sprint 12 six-language public matrix", () => {
  for (const language of LANGUAGES) {
    test(`${language} renders key public routes without raw keys or clipping`, async ({
      page,
    }) => {
      await setLanguageAndTheme(page, language);
      await mockPublicReads(page);

      for (const route of PUBLIC_ROUTES) {
        await test.step(route, async () => {
          await waitForStablePublicPage(page, route);
          await expect(page.locator("html")).toHaveAttribute(
            "lang",
            HTML_LOCALES[language],
          );

          const bodyText = await page.locator("body").innerText();
          expect(
            bodyText.match(RAW_TRANSLATION_KEY),
            `${language} ${route} exposes a translation key`,
          ).toBeNull();
          await expect
            .poll(
              () => horizontalOverflowDetails(page),
              { message: `${language} ${route} has horizontal overflow` },
            )
            .toEqual([]);
          expect(
            await visibleClippedControls(page),
            `${language} ${route} clips an important control`,
          ).toEqual([]);
        });
      }
    });
  }
});

test.describe("Sprint 12 six-language home visual snapshots", () => {
  for (const language of LANGUAGES) {
    test(`home ${language} visual snapshot`, async ({ page }) => {
      await setLanguageAndTheme(page, language);
      await mockPublicReads(page);
      await waitForStablePublicPage(page, "/");
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        HTML_LOCALES[language],
      );

      await expect(page).toHaveScreenshot(`sprint12-home-${language}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: false,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});

test.describe("Sprint 12 language continuity and critical flows", () => {
  test("switching RU to UZ keeps the filled login form", async ({ page }) => {
    await setLanguageAndTheme(page, "ru");
    await mockPublicReads(page);
    await waitForStablePublicPage(page, "/auth");

    const identifier = page.getByTestId("auth-login-identifier");
    const password = page.getByTestId("auth-login-password");
    await identifier.fill("+998901234567");
    await password.fill("Sprint12-password");

    await page.getByRole("button", { name: /RU/ }).click();
    await page.getByRole("menuitem", { name: /UZ.*O.?zbekcha/i }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", HTML_LOCALES.uz);

    await expect(identifier).toHaveValue("+998901234567");
    await expect(password).toHaveValue("Sprint12-password");
    expect(new URL(page.url()).pathname).toBe("/auth");
  });

  for (const language of ["ru", "uz"] as const) {
    test(`${language} completes the public booking flow`, async ({ page }) => {
      await preparePublicBooking(page);
      await page.addInitScript((selectedLanguage) => {
        localStorage.setItem("language", selectedLanguage);
      }, language);
      await page.goto(`/book/${BOOKING_DOCTOR_ID}`, {
        waitUntil: "domcontentloaded",
      });

      const serviceName = language === "ru" ? "Консультация" : "Konsultatsiya";
      const submitName =
        language === "ru" ? /Подтвердить запись/ : /Yozuvni tasdiqlash/;
      const successText =
        language === "ru" ? "Запись подтверждена!" : "Yozuv tasdiqlandi!";

      await page.getByRole("button", { name: serviceName }).click();
      await page.getByRole("grid").locator("button:not([disabled])").first().click();
      await page.getByRole("button", { name: "09:15", exact: true }).click();
      await page.getByRole("button", { name: submitName }).click();
      await expect(page.getByText(successText)).toBeVisible();
    });
  }
});

test.describe("Sprint 12 light and dark visual baselines", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`home ${theme} visual snapshot`, async ({ page }) => {
      await setLanguageAndTheme(page, "ru", theme);
      await mockPublicReads(page);
      await waitForStablePublicPage(page, "/");
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));

      await expect(page).toHaveScreenshot(`sprint12-home-${theme}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: false,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
