import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { cascadeDeleteRows, resetRateLimits } from "./helpers/stand";
import { ACCOUNTS, ClinicApi, CLINIC_ID, QA_PASSWORD } from "./helpers/clinic";
import { loginViaUi } from "./helpers/auth-ui";

/**
 * Волна 5 плана ops/e2e-all-roles-plan.md — отдельные модули:
 * склад, лаборатория, маркетплейс, работа.
 *
 * Сами сквозные цепочки «двух сторон» уже проверяет набор sprint14-full-day по
 * API. Здесь добавлено то, чего нет нигде: доходят ли эти данные до экрана
 * нужной роли, и не видит ли их чужой.
 */

const TECHNICIAN_ID = "a1000000-0000-0000-0000-00000000000b";
const SUPPLIER_ID = "51000000-0000-0000-0000-00000000000a";
const PRODUCT_ID = "b6000000-0000-0000-0000-000000000001";

let api: ClinicApi;
const runId = randomUUID().slice(0, 8);
const materialName = `E2E материал ${runId}`;
let materialId = "";
let labOrderId = "";
let labOrderNumber = "";
let marketOrderId = "";
let vacancyTitle = "";
let vacancyId = "";

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
  await api.login("clinicAdmin", "assistant", "accountant", "doctor", "technician", "seller", "patient");
});

test.afterAll(async () => {
  // Уборка идёт каскадом по каталогу внешних ключей: у материала есть движения,
  // у вакансии — отклики и их события, и списки этих таблиц меняются от ветки
  // к ветке.
  if (materialId) cascadeDeleteRows("inventory", `SELECT id FROM inventory WHERE id = '${materialId}'`);
  if (vacancyId) cascadeDeleteRows("job_listings", `SELECT id FROM job_listings WHERE id = '${vacancyId}'`);
  await api?.dispose();
});

test.describe.serial("Склад", () => {
  test("администратор заводит материал, ассистент списывает — остаток сходится", async () => {
    const created = await api.request.post("/api/v1/sklad/items", {
      headers: api.headers("clinicAdmin", true),
      data: { name: materialName, unit: "шт", price_per_unit: 12000, quantity: 5 },
    });
    expect(created.ok(), `материал: HTTP ${created.status()} ${await created.text()}`).toBeTruthy();
    materialId = String((await created.json()).id);

    const movement = await api.request.post(`/api/v1/sklad/items/${materialId}/stock`, {
      headers: api.headers("assistant", true),
      data: {
        type: "expense",
        quantity: 2,
        reason: "E2E расход на приём",
        client_request_id: randomUUID(),
      },
    });
    expect(movement.ok(), `списание: HTTP ${movement.status()} ${await movement.text()}`).toBeTruthy();
    expect(Number((await movement.json()).balance_after), "5 минус 2").toBe(3);
  });

  test("материал с остатком виден на складе клиники", async ({ page }) => {
    await loginAs(page, ACCOUNTS.clinicAdmin, /\/crm/);
    await page.goto("/sklad", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(materialName).first()).toBeVisible({ timeout: 30_000 });
  });

  test("посторонний склад клиники не читает", async () => {
    const response = await api.request.get("/api/v1/sklad/items", {
      headers: { ...api.headers("seller"), "X-Clinic-Id": CLINIC_ID },
    });
    expect(response.ok(), "продавец в чужой склад не ходит").toBeFalsy();
  });
});

test.describe.serial("Лаборатория", () => {
  test("врач отправляет заказ технику", async () => {
    const response = await api.request.post("/api/v1/lab/orders", {
      headers: api.headers("doctor"),
      data: {
        technician_id: TECHNICIAN_ID,
        client_request_id: randomUUID(),
        work_type: "crown",
        material: "zirconia",
        tooth: "21",
        shade: "A2",
        priority: "normal",
        price: 250000,
        currency: "UZS",
        notes: `E2E заказ ${runId}`,
      },
    });
    expect(response.ok(), `лаб-заказ: HTTP ${response.status()} ${await response.text()}`).toBeTruthy();
    const order = await response.json();
    labOrderId = String(order.id);
    labOrderNumber = String(order.order_number ?? "");
    expect(labOrderId).toBeTruthy();
  });

  test("техник видит заказ в своём кабинете", async ({ page }) => {
    await loginAs(page, ACCOUNTS.technician, /\/technician/);
    const marker = labOrderNumber || "zirconia";
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 30_000 });
  });

  test("чужая роль лабораторный заказ не открывает", async () => {
    const response = await api.request.get(`/api/v1/lab/orders/${labOrderId}`, {
      headers: api.headers("seller"),
    });
    expect(response.ok(), "продавцу заказ лаборатории не положен").toBeFalsy();
  });

  test("техник принимает заказ в работу", async () => {
    const response = await api.request.post(`/api/v1/lab/orders/${labOrderId}/accept`, {
      headers: api.headers("technician"),
    });
    expect(response.ok(), `принятие: HTTP ${response.status()} ${await response.text()}`).toBeTruthy();
  });
});

test.describe.serial("Маркетплейс", () => {
  test("клиника заказывает у поставщика, продавец видит заказ", async () => {
    const created = await api.request.post("/api/v1/marketplace/orders", {
      headers: api.headers("clinicAdmin"),
      data: {
        supplier_id: SUPPLIER_ID,
        buyer_clinic_id: CLINIC_ID,
        client_request_id: randomUUID(),
        contact_name: "E2E покупатель",
        contact_phone: "+998900001414",
        delivery_address: "Ташкент",
        currency: "UZS",
        items: [{ product_id: PRODUCT_ID, quantity: 1 }],
      },
    });
    expect(created.ok(), `заказ: HTTP ${created.status()} ${await created.text()}`).toBeTruthy();
    marketOrderId = String((await created.json()).id);

    const sellerView = await api.request.get("/api/v1/marketplace/orders", {
      headers: api.headers("seller"),
    });
    expect(sellerView.ok()).toBeTruthy();
    const orders = await sellerView.json();
    const rows = Array.isArray(orders) ? orders : orders.items ?? orders.content ?? [];
    expect(
      rows.some((row: { id: string }) => String(row.id) === marketOrderId),
      "заказ должен появиться у продавца",
    ).toBe(true);
  });

  test("чужая клиника заказ поставщика не видит", async () => {
    const response = await api.request.get(`/api/v1/marketplace/orders/${marketOrderId}`, {
      headers: api.headers("technician"),
    });
    expect(response.ok(), "техник к чужому заказу не допускается").toBeFalsy();
  });

  test("каталог маркетплейса открывается врачу", async ({ page }) => {
    await loginAs(page, ACCOUNTS.doctor, /\/crm|\/doctor/);
    await page.goto("/market", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  });
});

test.describe.serial("Работа", () => {
  test("клиника публикует вакансию", async () => {
    vacancyTitle = `E2E вакансия ${runId}`;
    const response = await api.request.post("/api/v1/jobs/listings", {
      headers: api.headers("clinicAdmin"),
      data: {
        listing_type: "vacancy",
        category: "dental_assistant",
        title: vacancyTitle,
        description: "Тестовая вакансия сквозного набора",
        cooperation_type: "staff_doctor",
        salary_mode: "fixed",
        salary_min: 8000000,
        status: "published",
        contact_name: "QA Clinic",
        contact_phone: "+998900001414",
      },
    });
    expect(response.ok(), `вакансия: HTTP ${response.status()} ${await response.text()}`).toBeTruthy();
    vacancyId = String((await response.json()).id);
  });

  // Витрина «Работы» открыта врачам и клиникам, пациенту она не положена —
  // поэтому соискателем здесь выступает врач.
  test("вакансия видна соискателю на витрине", async ({ page }) => {
    await loginAs(page, ACCOUNTS.doctor, /\/crm|\/doctor/);
    await page.goto("/jobs", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(vacancyTitle).first()).toBeVisible({ timeout: 30_000 });
  });

  test("соискатель откликается, клиника видит отклик", async () => {
    const resume = await api.request.put("/api/v1/jobs/resume", {
      headers: api.headers("doctor"),
      data: {
        category: "dentist_therapist",
        headline: `E2E кандидат ${runId}`,
        visibility: "public",
        is_open_to_work: true,
        contact_phone: "+998900001415",
      },
    });
    expect(resume.ok(), `резюме: HTTP ${resume.status()} ${await resume.text()}`).toBeTruthy();

    const application = await api.request.post("/api/v1/jobs/applications", {
      headers: api.headers("doctor"),
      data: { listing_id: vacancyId, cover_message: "Готов приступить" },
    });
    expect(
      application.ok(),
      `отклик: HTTP ${application.status()} ${await application.text()}`,
    ).toBeTruthy();

    // Клиника смотрит отклики со своей стороны стола — отсюда ?role=clinic.
    const clinicView = await api.request.get("/api/v1/jobs/applications?role=clinic", {
      headers: api.headers("clinicAdmin"),
    });
    expect(clinicView.ok(), `отклики клиники: HTTP ${clinicView.status()}`).toBeTruthy();
    const body = await clinicView.json();
    const rows = Array.isArray(body) ? body : body.items ?? body.content ?? [];
    expect(
      rows.some((row: { listing_id?: string }) => String(row.listing_id) === vacancyId),
      "клиника должна видеть отклик на свою вакансию",
    ).toBe(true);
  });
});
