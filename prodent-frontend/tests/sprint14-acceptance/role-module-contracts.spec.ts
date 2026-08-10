import { expect, test, type Page, type Route } from "@playwright/test";

type AppRole =
  | "patient"
  | "doctor"
  | "assistant"
  | "accountant"
  | "clinic_manager"
  | "clinic_admin"
  | "seller"
  | "technician"
  | "super_admin";

interface AcceptanceScenario {
  name: string;
  route: string;
  role?: AppRole;
}

const USER_ID = "00000000-0000-4000-8000-000000001414";
const CLINIC_ID = "00000000-0000-4000-8000-000000001415";
const DOCTOR_ID = "00000000-0000-4000-8000-000000001416";

const scenarios: readonly AcceptanceScenario[] = [
  { name: "пациент открывает главную витрину", route: "/" },
  { name: "пациент ищет врача", route: "/search" },
  { name: "пациент ищет клинику", route: "/clinics" },
  { name: "пациент читает статьи", route: "/articles" },
  { name: "пациент открывает акции", route: "/promotions" },
  { name: "пациент открывает вход", route: "/auth" },
  { name: "пациент видит свои записи", route: "/patient/appointments", role: "patient" },
  { name: "пациент видит историю лечения", route: "/patient/history", role: "patient" },
  { name: "пациент видит медицинские данные", route: "/patient/medical", role: "patient" },
  { name: "пациент видит свои файлы", route: "/patient/files", role: "patient" },
  { name: "врач открывает календарь", route: "/doctor/calendar", role: "doctor" },
  { name: "врач открывает список пациентов", route: "/doctor/patients", role: "doctor" },
  { name: "врач открывает планы лечения", route: "/doctor/treatment-plans", role: "doctor" },
  { name: "врач открывает лабораторию", route: "/doctor/laboratory", role: "doctor" },
  { name: "клиника открывает CRM", route: "/crm", role: "clinic_admin" },
  { name: "клиника открывает расписание", route: "/crm/schedule", role: "clinic_admin" },
  { name: "клиника открывает базу пациентов", route: "/crm/patients", role: "clinic_admin" },
  { name: "клиника открывает финансы", route: "/crm/finance", role: "clinic_admin" },
  { name: "клиника открывает планы лечения", route: "/crm/treatment-plans", role: "clinic_admin" },
  { name: "ассистент открывает расписание", route: "/assistant/schedule", role: "assistant" },
  { name: "ассистент открывает материалы", route: "/assistant/materials", role: "assistant" },
  { name: "бухгалтер открывает платежи", route: "/accountant/payments", role: "accountant" },
  { name: "бухгалтер открывает отчёты", route: "/accountant/reports", role: "accountant" },
  { name: "менеджер открывает KPI", route: "/manager/kpi", role: "clinic_manager" },
  { name: "менеджер открывает услуги", route: "/manager/services", role: "clinic_manager" },
  { name: "администратор клиники открывает записи", route: "/clinic-admin/appointments", role: "clinic_admin" },
  { name: "администратор клиники открывает настройки", route: "/clinic-admin/settings", role: "clinic_admin" },
  { name: "техник открывает производство", route: "/technician/production", role: "technician" },
  { name: "техник открывает материалы", route: "/technician/materials", role: "technician" },
  { name: "продавец открывает заказы", route: "/seller/orders", role: "seller" },
  { name: "продавец открывает склад", route: "/seller/warehouse", role: "seller" },
  { name: "покупатель открывает каталог", route: "/market" },
  { name: "покупатель открывает корзину", route: "/market/cart" },
  { name: "соискатель открывает вакансии", route: "/jobs", role: "doctor" },
  { name: "врач открывает личный склад", route: "/sklad", role: "doctor" },
  { name: "врач открывает лабораторные заказы", route: "/lab", role: "doctor" },
  { name: "администратор открывает верификацию", route: "/admin/verification", role: "super_admin" },
  { name: "администратор открывает модерацию", route: "/admin/moderation", role: "super_admin" },
  { name: "администратор открывает рассылку", route: "/admin/broadcast", role: "super_admin" },
  { name: "администратор открывает споры маркетплейса", route: "/admin/market/disputes", role: "super_admin" },
] as const;

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function prepareDeterministicSession(page: Page, role?: AppRole) {
  await page.addInitScript(
    ({ selectedRole, userId, clinicId }) => {
      localStorage.setItem("language", "ru");
      localStorage.setItem("theme", "light");
      localStorage.setItem("prodent_current_clinic", clinicId);
      sessionStorage.clear();

      if (!selectedRole) {
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
        email: `sprint14.${selectedRole}@prodent.test`,
        roles: [selectedRole],
      })}.test-signature`;

      localStorage.setItem("prodent_access_token", token);
      localStorage.setItem("prodent_refresh_token", "sprint14-local-refresh");
      localStorage.setItem(
        "prodent_user_profile",
        JSON.stringify({
          id: userId,
          email: `sprint14.${selectedRole}@prodent.test`,
          firstName: "Sprint",
          lastName: "Fourteen",
          roles: [selectedRole],
        }),
      );
    },
    { selectedRole: role, userId: USER_ID, clinicId: CLINIC_ID },
  );

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const selectedRole = role ?? "patient";

    if (path === "/api/v1/data/user_roles") {
      return fulfillJson(route, [{ role: selectedRole }]);
    }
    if (path === "/api/v1/data/clinic_members") {
      return fulfillJson(route, [
        { clinic_id: CLINIC_ID, user_id: USER_ID, role: selectedRole, is_active: true },
      ]);
    }
    if (path === "/api/v1/data/doctors") {
      return fulfillJson(
        route,
        selectedRole === "doctor" ? [{ id: DOCTOR_ID, user_id: USER_ID }] : [],
      );
    }
    if (path === "/api/v1/data/doctor_clinic_affiliations") {
      return fulfillJson(route, [
        {
          doctor_id: DOCTOR_ID,
          clinic_id: CLINIC_ID,
          cooperation_type: "staff_doctor",
          salary_percent: 30,
          is_primary: true,
          is_active: true,
        },
      ]);
    }
    if (path === "/api/v1/jobs/listings") {
      return fulfillJson(route, []);
    }
    if (path === "/api/v1/marketplace/catalog") {
      return fulfillJson(route, { content: [], totalElements: 0, totalPages: 0 });
    }

    return fulfillJson(route, []);
  });

  await page.route("https://ipapi.co/**", (route) => route.abort());
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
}

test.describe("Sprint 14 — разные бизнес-модули и роли", () => {
  for (const scenario of scenarios) {
    test(scenario.name, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await prepareDeterministicSession(page, scenario.role);
      await page.goto(scenario.route, { waitUntil: "domcontentloaded" });

      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
        .toBe(scenario.route);
      await expect(page.locator("#root")).toBeVisible();
      await expect(page.locator("body")).not.toBeEmpty();
      expect(pageErrors, `Ошибки страницы: ${pageErrors.join(" | ")}`).toEqual([]);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "Страница не должна уходить за правый край").toBeLessThanOrEqual(2);
    });
  }
});
