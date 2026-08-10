import { expect, test, type Page } from "@playwright/test";
import { resetRateLimits } from "./helpers/stand";
import { ACCOUNTS, ClinicApi, QA_PASSWORD } from "./helpers/clinic";
import { loginViaUi } from "./helpers/auth-ui";

/**
 * Волна 7 плана ops/e2e-all-roles-plan.md — что должно НЕ работать, плюс язык
 * и мобильный экран.
 *
 * Здесь нет «полезных» сценариев: тест проверяет двери, а не комнаты.
 */

let api: ClinicApi;

async function loginAs(page: Page, email: string, homePattern: RegExp): Promise<void> {
  await loginViaUi(page, email, QA_PASSWORD);
  await expect(page).toHaveURL(homePattern, { timeout: 30_000 });
}

test.beforeEach(() => {
  resetRateLimits();
});

test.beforeAll(async () => {
  resetRateLimits();
  api = await ClinicApi.create();
  await api.login("patient", "doctor", "seller", "technician");
});

test.afterAll(async () => {
  await api?.dispose();
});

test.describe("Без входа", () => {
  const protectedRoutes = [
    "/patient/appointments",
    "/crm/patients",
    "/admin",
    "/accountant/invoices",
    "/technician",
  ];

  for (const route of protectedRoutes) {
    test(`«${route}» без входа не открывается`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
        .not.toBe(route);
    });
  }

  test("страница календаря врача без входа отправляет на вход и не показывает данные", async ({ page }) => {
    await page.goto("/doctor/calendar", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth(?:\?|$)/, { timeout: 30_000 });
    const content = (await page.locator("body").textContent()) ?? "";
    expect(content, "имя пациента постороннему показывать нельзя").not.toContain("QA Patient");
  });

  test("защищённый список записей без токена недоступен", async () => {
    const response = await api.request.get("/api/v1/appointments/my");
    expect(response.ok(), "без входа данных не выдаём").toBeFalsy();
    expect(response.status()).toBe(401);
  });
});

test.describe("Чужие кабинеты", () => {
  const foreignRoutes: Array<[string, string]> = [
    ["/admin", "админ-панель"],
    ["/accountant/invoices", "кабинет бухгалтера"],
    ["/technician", "кабинет техника"],
  ];

  for (const [route, label] of foreignRoutes) {
    test(`пациент не попадает в ${label}`, async ({ page }) => {
      await loginAs(page, ACCOUNTS.patient, /\/patient/);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
        .not.toBe(route);
    });
  }

  test("продавец не читает пациентов клиники", async () => {
    const response = await api.request.get("/api/v1/crm/clinics/c0000000-0000-0000-0000-000000000001/patients?query=QA", {
      headers: api.headers("seller"),
    });
    expect(response.ok(), "продавцу база пациентов не положена").toBeFalsy();
  });
});

test.describe("Язык интерфейса", () => {
  test("кабинет пациента переключается на узбекский без сырых ключей", async ({ page }) => {
    await loginAs(page, ACCOUNTS.patient, /\/patient/);
    await page.goto("/patient/appointments", { waitUntil: "domcontentloaded" });

    for (const language of ["ru", "uz"]) {
      await page.evaluate((lang) => localStorage.setItem("language", lang), language);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });

      // «Сырой ключ» — это когда вместо текста на экран попадает
      // patientCabinet.myAppointments: перевод не найден.
      const rawKeys = await page.evaluate(() => {
        const text = document.querySelector("main")?.textContent ?? "";
        return text.match(/\b[a-z][a-zA-Z]+\.[a-z][a-zA-Z]{3,}\b/g) ?? [];
      });
      const suspicious = rawKeys.filter(
        (key) => !key.includes("prodent") && !key.includes("www") && !key.endsWith(".uz"),
      );
      expect(suspicious, `язык ${language}: на экране остались ключи перевода`).toEqual([]);
    }
  });
});

test.describe("Мобильный экран", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("кабинет пациента не разъезжается по горизонтали", async ({ page }) => {
    await loginAs(page, ACCOUNTS.patient, /\/patient/);
    await page.goto("/patient/appointments", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    // Пара пикселей округления допустима, полоса прокрутки вбок — нет.
    expect(overflow, "страница шире экрана").toBeLessThanOrEqual(2);
  });

  test("кабинет клиники не разъезжается по горизонтали", async ({ page }) => {
    await loginAs(page, ACCOUNTS.doctor, /\/crm|\/doctor/);
    await page.goto("/crm/patients", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow, "страница шире экрана").toBeLessThanOrEqual(2);
  });
});
