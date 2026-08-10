import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { cleanupAppointmentsForDate, resetRateLimits, sql, sqlValue } from "./helpers/stand";
import {
  ACCOUNTS,
  ClinicApi,
  CLINIC_ID,
  DOCTOR_ID,
  OTHER_CLINIC_ID,
  PATIENT_ID,
  QA_PASSWORD,
} from "./helpers/clinic";
import { loginViaUi } from "./helpers/auth-ui";

/**
 * Волна 4 плана ops/e2e-all-roles-plan.md — деньги: счёт по завершённому визиту,
 * его оплата и то, что видят пациент и бухгалтер.
 */

let api: ClinicApi;
let serviceId = "";
let visitDate = "";
let appointmentId = "";
let appointmentTotal = 0;
let invoiceId = "";
let invoiceNumber = "";
let invoiceRequestId = "";

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
  await api.login("patient", "doctor", "clinicAdmin", "accountant", "assistant", "seller");

  serviceId = await api.serviceId();
  const free = await api.findFreeDate(serviceId, 1);
  visitDate = free.date;
  cleanupAppointmentsForDate(DOCTOR_ID, visitDate);

  const slots = await api.slots(serviceId, visitDate);
  appointmentId = await api.createAppointment(serviceId, visitDate, slots[0], "E2E волна 4");
  await api.setStatus(appointmentId, "CONFIRMED", "clinicAdmin");
  await api.setStatus(appointmentId, "IN_PROGRESS", "doctor");

  // Визит закрывает врач — одной транзакцией вместе с клиническим содержимым.
  const finished = await api.request.post("/api/v1/appointments/finish", {
    headers: api.headers("doctor", true),
    data: {
      appointmentId,
      expectedVersion: 0,
      diagnosis: "K02.1",
      treatment: "Лечение кариеса",
      notes: "E2E волна 4",
      clientRequestId: randomUUID(),
    },
  });
  expect(
    finished.ok(),
    `завершение визита: HTTP ${finished.status()} ${await finished.text()}`,
  ).toBeTruthy();

  appointmentTotal = Number(
    sqlValue(`SELECT total_price FROM appointments WHERE id = '${appointmentId}'`),
  );
  expect(appointmentTotal, "у завершённого визита должна быть цена").toBeGreaterThan(0);
});

test.afterAll(async () => {
  if (visitDate) cleanupAppointmentsForDate(DOCTOR_ID, visitDate);
  await api?.dispose();
});

test.describe.serial("Счёт за визит", () => {
  test("произвольную сумму выставить нельзя", async () => {
    const response = await api.request.post(`/api/v1/crm/clinics/${CLINIC_ID}/invoices`, {
      headers: api.headers("clinicAdmin"),
      data: {
        clientRequestId: randomUUID(),
        patientId: PATIENT_ID,
        appointmentId,
        subtotal: appointmentTotal + 1,
        discount: 0,
        tax: 0,
        notes: "E2E подмена суммы",
      },
    });
    expect(response.status(), "сумму счёта диктует сервер, а не клиент").toBe(400);
  });

  test("клиника выставляет счёт по серверной цене", async () => {
    invoiceRequestId = randomUUID();
    const response = await api.request.post(`/api/v1/crm/clinics/${CLINIC_ID}/invoices`, {
      headers: api.headers("clinicAdmin"),
      data: {
        clientRequestId: invoiceRequestId,
        patientId: PATIENT_ID,
        appointmentId,
        subtotal: appointmentTotal,
        discount: 0,
        tax: 0,
        notes: "E2E счёт за визит",
      },
    });
    expect(response.ok(), `счёт: HTTP ${response.status()} ${await response.text()}`).toBeTruthy();
    const invoice = await response.json();
    invoiceId = String(invoice.id);
    invoiceNumber = String(invoice.invoice_number);
    expect(invoice.status).toBe("SENT");
  });

  test("повтор запроса не создаёт второй счёт", async () => {
    const response = await api.request.post(`/api/v1/crm/clinics/${CLINIC_ID}/invoices`, {
      headers: api.headers("clinicAdmin"),
      data: {
        clientRequestId: invoiceRequestId,
        patientId: PATIENT_ID,
        appointmentId,
        subtotal: appointmentTotal,
        discount: 0,
        tax: 0,
        notes: "E2E счёт за визит",
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(String((await response.json()).id)).toBe(invoiceId);
    expect(sqlValue(`SELECT count(*) FROM invoices WHERE appointment_id = '${appointmentId}'`)).toBe("1");
  });

  test("номера счетов у двух клиник не сталкиваются", async () => {
    // Регресс на фикс 0d9bbf1: раньше первая клиника занимала номер
    // INV-<год>-000001 глобально, и первый счёт любой другой клиники падал.
    const first = sqlValue(`SELECT generate_invoice_number('${CLINIC_ID}'::uuid)`);
    const second = sqlValue(`SELECT generate_invoice_number('${OTHER_CLINIC_ID}'::uuid)`);
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    // Уникальность теперь в паре (клиника, номер) — одинаковые номера у разных
    // клиник допустимы и не должны ломать вставку.
    const constraint = sqlValue(`
      SELECT string_agg(a.attname, ',' ORDER BY a.attname)
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
       WHERE c.conrelid = 'invoices'::regclass
         AND c.contype = 'u'
         AND c.conname = 'invoices_clinic_invoice_number_key'`);
    expect(constraint, "уникальность должна быть по паре «клиника + номер»")
      .toBe("clinic_id,invoice_number");
  });

  test("пациент видит свой неоплаченный счёт", async () => {
    const response = await api.request.get("/api/v1/payments/patient-history", {
      headers: api.headers("patient"),
    });
    expect(response.ok(), `история пациента: HTTP ${response.status()}`).toBeTruthy();
    const history = await response.json();
    const invoice = history.invoices.find((row: { id: string }) => String(row.id) === invoiceId);
    expect(invoice, "счёт должен быть виден пациенту").toBeTruthy();
    expect(invoice.status).toBe("SENT");
    expect(Number(invoice.balance_due)).toBe(appointmentTotal);
  });

  test("посторонний пользователь чужой счёт не получает", async () => {
    const response = await api.request.get("/api/v1/payments/patient-history", {
      headers: api.headers("seller"),
    });
    expect(response.ok()).toBeTruthy();
    const history = await response.json();
    expect(
      history.invoices.some((row: { id: string }) => String(row.id) === invoiceId),
      "чужие счета видеть нельзя",
    ).toBe(false);
  });

  test("счёт виден пациенту в кабинете", async ({ page }) => {
    await loginAs(page, ACCOUNTS.patient, /\/patient/);
    await page.goto("/patient/billing", { waitUntil: "domcontentloaded" });

    await page.getByTestId("patient-payments-tab-invoices").click();
    const row = page.locator(`[data-testid="patient-invoice-row"][data-invoice-id="${invoiceId}"]`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(invoiceNumber);
    await expect(row).toHaveAttribute("data-invoice-status", "sent");
  });
});

test.describe.serial("Оплата", () => {
  let paymentRequestId = "";

  test("ассистент оплату не проводит", async () => {
    const response = await api.request.post(`/api/v1/crm/clinics/${CLINIC_ID}/payments`, {
      headers: api.headers("assistant"),
      data: {
        clientRequestId: randomUUID(),
        invoiceId,
        amount: appointmentTotal,
        method: "CASH",
        notes: "E2E ассистент",
      },
    });
    expect(response.ok(), "деньги — не зона ассистента").toBeFalsy();
  });

  test("оплата «через провайдера» без подписи отклоняется", async () => {
    const response = await api.request.post(`/api/v1/crm/clinics/${CLINIC_ID}/payments`, {
      headers: api.headers("accountant"),
      data: {
        clientRequestId: randomUUID(),
        invoiceId,
        amount: appointmentTotal,
        method: "PAYME",
        notes: "E2E чужой провайдер",
      },
    });
    expect(response.status(), "имя платёжной системы вручную не проставляют").toBe(400);
  });

  test("бухгалтер проводит оплату картой — долг закрыт", async () => {
    paymentRequestId = randomUUID();
    const response = await api.request.post(`/api/v1/crm/clinics/${CLINIC_ID}/payments`, {
      headers: api.headers("accountant"),
      data: {
        clientRequestId: paymentRequestId,
        invoiceId,
        amount: appointmentTotal,
        method: "CARD",
        notes: "E2E оплата картой",
      },
    });
    expect(response.ok(), `оплата: HTTP ${response.status()} ${await response.text()}`).toBeTruthy();
    const payment = await response.json();
    expect(payment.status).toBe("COMPLETED");
    expect(Number(payment.invoiceBalanceDue)).toBe(0);
  });

  test("повтор оплаты не создаёт вторую транзакцию", async () => {
    const response = await api.request.post(`/api/v1/crm/clinics/${CLINIC_ID}/payments`, {
      headers: api.headers("accountant"),
      data: {
        clientRequestId: paymentRequestId,
        invoiceId,
        amount: appointmentTotal,
        method: "CARD",
        notes: "E2E оплата картой",
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(sqlValue(`SELECT count(*) FROM payments WHERE invoice_id = '${invoiceId}'`)).toBe("1");
  });

  test("оплаченный счёт виден пациенту как закрытый", async () => {
    const response = await api.request.get("/api/v1/payments/patient-history", {
      headers: api.headers("patient"),
    });
    const history = await response.json();
    const invoice = history.invoices.find((row: { id: string }) => String(row.id) === invoiceId);
    expect(Number(invoice.balance_due)).toBe(0);
    expect(
      history.payments.some((row: { invoice_id: string }) => String(row.invoice_id) === invoiceId),
      "оплата должна попасть в историю пациента",
    ).toBe(true);
  });

  test("бухгалтер видит счёт в своём кабинете", async ({ page }) => {
    await loginAs(page, ACCOUNTS.accountant, /\/accountant/);
    await expect(page.getByText(invoiceNumber).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.afterAll(() => {
  if (invoiceId) {
    // Счёт и оплата уходят вместе с записью, но подчистим и напрямую —
    // на случай, если запись уже удалена предыдущим прогоном.
    sql(`DELETE FROM payments WHERE invoice_id = '${invoiceId}'`);
    sql(`DELETE FROM invoices WHERE id = '${invoiceId}'`);
  }
});
