import { expect, test, type Page } from "@playwright/test";
import { resetRateLimits, sqlValue } from "./helpers/stand";
import { ACCOUNTS, ClinicApi, CLINIC_ID, QA_PASSWORD } from "./helpers/clinic";
import { loginViaUi } from "./helpers/auth-ui";

/**
 * Волна 6 плана ops/e2e-all-roles-plan.md — управляющие роли:
 * администратор, модератор, менеджер клиники, супер-админ.
 *
 * Проверяем две вещи: попадает ли роль в свой рабочий экран и видит ли там
 * настоящие данные — и не пускает ли система туда, куда не положено.
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
  await api.login("superAdmin", "admin", "moderator", "clinicManager", "doctor", "patient");
});

test.afterAll(async () => {
  await api?.dispose();
});

test.describe("Администратор", () => {
  test("админ открывает свою панель", async ({ page }) => {
    await loginAs(page, ACCOUNTS.admin, /\/admin/);
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  });

  test("страница проверки заявок открывается", async ({ page }) => {
    await loginAs(page, ACCOUNTS.admin, /\/admin/);
    await page.goto("/admin/verification", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
      .toBe("/admin/verification");
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  });

  test("врач в админскую панель не попадает", async ({ page }) => {
    await loginAs(page, ACCOUNTS.doctor, /\/crm|\/doctor/);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
      .not.toBe("/admin");
  });

  test("пациент заявки на проверку не читает", async () => {
    const response = await api.request.get(
      "/api/v1/data/technician_applications?select=id&limit=1",
      { headers: api.headers("patient") },
    );
    const body = await response.text();
    // Либо отказ, либо пустой список — но не чужие персональные данные.
    if (response.ok()) {
      expect(body.trim(), "пациенту заявки видеть не за чем").toBe("[]");
    }
  });
});

test.describe("Модератор", () => {
  test("модератор попадает в раздел модерации", async ({ page }) => {
    await loginAs(page, ACCOUNTS.moderator, /\/admin\/moderation/);
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  });

  test("модератор не меняет настройки платформы", async () => {
    const response = await api.request.patch(
      "/api/v1/data/platform_settings?key=eq.maintenance_mode",
      {
        headers: { ...api.headers("moderator"), Prefer: "return=representation" },
        data: { value: "true" },
      },
    );
    expect(response.ok(), "настройки платформы — не зона модератора").toBeFalsy();
  });
});

test.describe("Менеджер клиники", () => {
  test("менеджер открывает свой дашборд", async ({ page }) => {
    await loginAs(page, ACCOUNTS.clinicManager, /\/manager\/dashboard/);
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  });

  test("менеджер видит записи своей клиники", async () => {
    const response = await api.request.get(`/api/v1/appointments/clinic/${CLINIC_ID}?size=10`, {
      headers: api.headers("clinicManager"),
    });
    expect(response.ok(), `записи клиники: HTTP ${response.status()}`).toBeTruthy();
  });

  test("менеджер не читает записи чужой клиники", async () => {
    const response = await api.request.get(
      "/api/v1/appointments/clinic/c2000000-0000-0000-0000-000000000002?size=10",
      { headers: api.headers("clinicManager") },
    );
    expect(response.ok(), "чужая клиника — закрытая дверь").toBeFalsy();
  });
});

test.describe("Супер-админ", () => {
  test("супер-админ читает журнал аудита", async () => {
    const response = await api.request.get("/api/v1/data/audit_logs?select=id&limit=1", {
      headers: api.headers("superAdmin"),
    });
    expect(response.ok(), `журнал аудита: HTTP ${response.status()}`).toBeTruthy();

    // В журнале уже есть записи: сиды и предыдущие волны работали через API.
    expect(Number(sqlValue("SELECT count(*) FROM audit_logs") || "0")).toBeGreaterThan(0);
  });

  test("обычный пользователь журнал аудита не читает", async () => {
    const response = await api.request.get("/api/v1/data/audit_logs?select=id&limit=1", {
      headers: api.headers("patient"),
    });
    if (response.ok()) {
      expect((await response.text()).trim(), "журнал аудита — только для админов").toBe("[]");
    }
  });
});
