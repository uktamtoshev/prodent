import { expect, test, type Page } from "@playwright/test";
import { cleanupAppointmentsForDate, resetRateLimits, sqlValue } from "./helpers/stand";
import {
  ACCOUNTS,
  ClinicApi,
  CLINIC_ID,
  DOCTOR_ID,
  PATIENT_ID,
  QA_PASSWORD,
} from "./helpers/clinic";
import { loginViaUi } from "./helpers/auth-ui";

/**
 * Волна 3 плана ops/e2e-all-roles-plan.md — рабочий день клиники:
 * подтверждение записи → приём у врача → медицинский документ → план лечения.
 *
 * Через экран идёт то, чего нет ни в одном другом наборе: сам приём у врача
 * (протокол, черновик, завершение) и поиск пациента в CRM. Роли-декорации
 * (пациент, клиника) дёргаются по API.
 */

let api: ClinicApi;
let serviceId = "";
let visitDate = "";
let visitSlots: string[] = [];
let appointmentId = "";

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
  await api.login("patient", "doctor", "clinicAdmin", "assistant", "seller");

  serviceId = await api.serviceId();
  const free = await api.findFreeDate(serviceId, 2);
  visitDate = free.date;
  cleanupAppointmentsForDate(DOCTOR_ID, visitDate);
  visitSlots = await api.slots(serviceId, visitDate);

  appointmentId = await api.createAppointment(serviceId, visitDate, visitSlots[0], "E2E волна 3");
  await api.setStatus(appointmentId, "CONFIRMED", "clinicAdmin");
  await api.setStatus(appointmentId, "IN_PROGRESS", "doctor");
});

test.afterAll(async () => {
  if (visitDate) cleanupAppointmentsForDate(DOCTOR_ID, visitDate);
  await api?.dispose();
});

test.describe.serial("Клиника: поиск пациента", () => {
  test("поиск в CRM находит пациента по имени", async ({ page }) => {
    await loginAs(page, ACCOUNTS.clinicAdmin, /\/crm/);
    await page.goto("/crm/patients", { waitUntil: "domcontentloaded" });

    const patientName = sqlValue(
      `SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) FROM users WHERE id = '${PATIENT_ID}'`,
    );
    expect(patientName, "у QA-пациента должно быть имя").toBeTruthy();

    await page.getByTestId("crm-patient-search").fill(patientName!.split(" ")[0]);
    await expect(page.getByTestId("crm-patient-result").first()).toBeVisible({ timeout: 30_000 });
  });

  test("бессмысленный запрос не выдаёт всех пациентов подряд", async ({ page }) => {
    await loginAs(page, ACCOUNTS.clinicAdmin, /\/crm/);
    await page.goto("/crm/patients", { waitUntil: "domcontentloaded" });

    // Регресс на свежий фикс: раньше любой запрос возвращал весь список клиники.
    await page.getByTestId("crm-patient-search").fill("щщщнеттакогопациента");
    await page.waitForTimeout(2_000);
    await expect(page.getByTestId("crm-patient-result")).toHaveCount(0);
  });
});

test.describe.serial("Врач: приём", () => {
  test("врач открывает экран визита своей записи", async ({ page }) => {
    await loginAs(page, ACCOUNTS.doctor, /\/crm|\/doctor/);
    await page.goto(`/doctor/visit/${appointmentId}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("visit-field-complaints")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("visit-finish")).toBeVisible();
  });

  test("протокол приёма сохраняется как черновик на сервере", async ({ page }) => {
    await loginAs(page, ACCOUNTS.doctor, /\/crm|\/doctor/);
    await page.goto(`/doctor/visit/${appointmentId}`, { waitUntil: "domcontentloaded" });

    await page.getByTestId("visit-field-complaints").fill("Боль при накусывании");
    await page.getByTestId("visit-field-examination").fill("Кариес 36 зуба");
    await page.getByTestId("visit-field-procedures").fill("Лечение кариеса, пломба");
    await page.getByTestId("visit-field-recommendations").fill("Контроль через месяц");

    // Черновик уезжает на сервер автосохранением — ждём его в базе.
    await expect
      .poll(
        () =>
          sqlValue(
            `SELECT count(*) FROM medical_records WHERE appointment_id = '${appointmentId}'`,
          ),
        { timeout: 30_000 },
      )
      .toBe("1");

    const treatment = sqlValue(
      `SELECT treatment FROM medical_records WHERE appointment_id = '${appointmentId}' LIMIT 1`,
    );
    expect(treatment).toContain("пломба");
  });

  test("пациент черновик врача не видит", async () => {
    const response = await api.request.get(`/api/v1/appointments/${appointmentId}/visit`, {
      headers: api.headers("patient"),
    });
    expect(response.ok(), "черновик — внутренний документ клиники").toBeFalsy();
  });

  test("посторонний в чужой визит не попадает", async () => {
    const response = await api.request.get(`/api/v1/appointments/${appointmentId}/visit`, {
      headers: api.headers("seller"),
    });
    expect(response.ok(), "чужой пользователь визит не читает").toBeFalsy();
  });

  test("врач завершает приём — запись закрыта, документ финализирован", async ({ page }) => {
    await loginAs(page, ACCOUNTS.doctor, /\/crm|\/doctor/);
    await page.goto(`/doctor/visit/${appointmentId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("visit-field-complaints")).toBeVisible({ timeout: 30_000 });

    // Заполняем заново: экран открыт в новом браузере, черновик подтянется с сервера,
    // но диагноз нужен обязательно — без него завершение блокируется.
    await page.getByTestId("visit-field-procedures").fill("Лечение кариеса, пломба поставлена");
    await page.waitForTimeout(2_000);
    await page.getByTestId("visit-finish").click();

    await expect
      .poll(
        () => sqlValue(`SELECT upper(status::text) FROM appointments WHERE id = '${appointmentId}'`),
        { timeout: 60_000 },
      )
      .toBe("COMPLETED");

    expect(
      sqlValue(`SELECT completed_at IS NOT NULL FROM appointments WHERE id = '${appointmentId}'`),
    ).toBe("t");
  });

  test("пациент видит завершённый документ приёма", async () => {
    const response = await api.request.get(`/api/v1/appointments/${appointmentId}/visit`, {
      headers: api.headers("patient"),
    });
    expect(
      response.ok(),
      `финальный документ пациенту: HTTP ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
  });
});

test.describe.serial("Врач: план лечения", () => {
  let planId = "";
  let shareToken = "";

  test("врач составляет план лечения пациенту", async () => {
    const response = await api.request.post("/api/v1/treatment-plans", {
      headers: api.headers("doctor"),
      data: {
        patientId: PATIENT_ID,
        clinicId: CLINIC_ID,
        title: "E2E план лечения",
        description: "Волна 3",
        items: [{
          serviceId,
          toothNumber: 36,
          description: "Лечение кариеса",
          quantity: 1,
          unitPrice: 75000,
          stageName: "Этап 1",
          notes: "E2E",
        }],
        discountType: "PERCENT",
        discountValue: 0,
        discountComment: "Без скидки",
        patientConsentConfirmed: true,
      },
    });
    expect(
      response.ok(),
      `план лечения: HTTP ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
    planId = String((await response.json()).id);
    expect(planId).toBeTruthy();
  });

  test("публичная ссылка на план открывается, отозванная — нет", async () => {
    const share = await api.request.post(`/api/v1/treatment-plans/${planId}/share-link`, {
      headers: api.headers("doctor"),
      data: { ttlHours: 1 },
    });
    expect(share.ok(), `ссылка: HTTP ${share.status()}`).toBeTruthy();
    shareToken = String((await share.json()).token);

    const opened = await api.request.post("/api/v1/public/treatment-plans/resolve", {
      data: { token: shareToken },
    });
    expect(opened.ok(), "ссылка должна открываться").toBeTruthy();
    expect(String((await opened.json()).title)).toBe("E2E план лечения");

    const revoked = await api.request.delete(`/api/v1/treatment-plans/${planId}/share-link`, {
      headers: api.headers("doctor"),
    });
    expect(revoked.ok(), "отзыв ссылки").toBeTruthy();

    const afterRevoke = await api.request.post("/api/v1/public/treatment-plans/resolve", {
      data: { token: shareToken },
    });
    expect(afterRevoke.ok(), "отозванная ссылка не должна открываться").toBeFalsy();
  });

  test("пациент не выпускает ссылки от имени врача", async () => {
    const response = await api.request.post(`/api/v1/treatment-plans/${planId}/share-link`, {
      headers: api.headers("patient"),
      data: { ttlHours: 1 },
    });
    expect(response.ok(), "пациенту это не положено").toBeFalsy();
  });

  test("пациент видит свой план лечения", async () => {
    const response = await api.request.get(`/api/v1/treatment-plans/patient/${PATIENT_ID}`, {
      headers: api.headers("patient"),
    });
    expect(response.ok(), `планы пациента: HTTP ${response.status()}`).toBeTruthy();
    const plans = await response.json();
    const titles = (Array.isArray(plans) ? plans : plans.items ?? []).map(
      (plan: { title?: string }) => plan.title,
    );
    expect(titles, "план должен быть виден пациенту").toContain("E2E план лечения");
  });
});

test.describe("Права внутри клиники", () => {
  test("ассистент не может выставить счёт", async () => {
    const response = await api.request.post(`/api/v1/crm/clinics/${CLINIC_ID}/invoices`, {
      headers: api.headers("assistant", true),
      data: {
        appointmentId,
        patientId: PATIENT_ID,
        subtotal: 1000,
        total: 1000,
        clientRequestId: "e2e-assistant-invoice",
      },
    });
    expect(response.ok(), "финансы ассистенту недоступны").toBeFalsy();
  });
});
