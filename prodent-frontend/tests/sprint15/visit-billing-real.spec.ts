import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

const API = "http://127.0.0.1:8116";
const PASSWORD = "ProdentQa2026!";
const CLINIC_ID = "c0000000-0000-0000-0000-000000000001";
const FOREIGN_CLINIC_ID = "c2000000-0000-0000-0000-000000000002";
const DOCTOR_ID = "d1000000-0000-0000-0000-000000000005";
const PATIENT_ID = "a1000000-0000-0000-0000-000000000006";

const accounts = {
  clinic_admin: "qa-clinic-admin@prodent.local",
  doctor: "qa-doctor@prodent.local",
  patient: "qa-patient@prodent.local",
  accountant: "qa-accountant@prodent.local",
  seller: "qa-seller@prodent.local",
} as const;

type Role = keyof typeof accounts;
type Json = Record<string, unknown>;
type Availability = Json & { slots: Json[] };
type BillingHistory = Json & { invoices: Json[]; payments: Json[] };

let api: APIRequestContext;
const sessions = new Map<Role, Json>();
let serviceId = "";
let appointmentDate = "";
let appointmentStartTime = "";
let appointmentId = "";
let appointmentTotal = 0;
let bookingRequestId = "";
let medicalRecordId = "";
let treatmentPlanId = "";
let invoiceId = "";
let invoiceNumber = "";
let invoiceRequestId = "";
let paymentId = "";
let paymentRequestId = "";

function token(role: Role) {
  const value = sessions.get(role)?.access_token;
  if (!value) throw new Error(`Нет токена роли ${role}`);
  return String(value);
}

function headers(role: Role) {
  return { Authorization: `Bearer ${token(role)}` };
}

async function payload(response: import("@playwright/test").APIResponse) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function ok<T extends Json | Json[] = Json>(
  response: import("@playwright/test").APIResponse,
  label: string,
) {
  const body = await payload(response);
  expect(response.ok(), `${label}: HTTP ${response.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body as T;
}

async function status(
  response: import("@playwright/test").APIResponse,
  expected: number,
  label: string,
) {
  const body = await payload(response);
  expect(response.status(), `${label}: ${JSON.stringify(body)}`).toBe(expected);
}

test.describe.serial("Sprint 15 — визит, документы и оплата на реальном localhost", () => {
  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: API });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("пять участников входят через настоящий backend", async () => {
    for (const [role, email] of Object.entries(accounts) as [Role, string][]) {
      const session = await ok(
        await api.post("/api/v1/auth/login", { data: { email, password: PASSWORD } }),
        `login ${role}`,
      );
      sessions.set(role, session);
    }
  });

  test("пациент выбирает назначенную услугу и свободный слот", async () => {
    const assignments = await ok<Json[]>(
      await api.get(
        `/api/v1/data/clinic_doctor_services?clinic_id=eq.${CLINIC_ID}&doctor_id=eq.${DOCTOR_ID}&is_active=eq.true&limit=1`,
      ),
      "doctor service",
    );
    serviceId = String(assignments[0].service_id);
    const nextDay = new Date();
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    appointmentDate = nextDay.toISOString().slice(0, 10);
    const availability = await ok<Availability>(
      await api.get(
        `/api/v1/public/doctors/${DOCTOR_ID}/availability?clinicId=${CLINIC_ID}&serviceId=${serviceId}&date=${appointmentDate}`,
      ),
      "availability",
    );
    appointmentStartTime = String(availability.slots[0].startTime);
  });

  test("пациент создаёт запись с серверной ценой", async () => {
    bookingRequestId = randomUUID();
    const appointment = await ok(
      await api.post("/api/v1/appointments", {
        headers: headers("patient"),
        data: {
          doctorId: DOCTOR_ID,
          clinicId: CLINIC_ID,
          serviceId,
          appointmentDate,
          startTime: appointmentStartTime,
          notes: "Sprint 15 localhost",
          clientRequestId: bookingRequestId,
        },
      }),
      "create appointment",
    );
    appointmentId = String(appointment.id);
    appointmentTotal = Number(appointment.totalPrice);
    expect(appointment.status).toBe("PENDING");
    expect(appointmentTotal).toBeGreaterThan(0);
  });

  test("повтор записи не создаёт дубль", async () => {
    const replay = await ok(
      await api.post("/api/v1/appointments", {
        headers: headers("patient"),
        data: {
          doctorId: DOCTOR_ID,
          clinicId: CLINIC_ID,
          serviceId,
          appointmentDate,
          startTime: appointmentStartTime,
          notes: "Sprint 15 localhost",
          clientRequestId: bookingRequestId,
        },
      }),
      "appointment replay",
    );
    expect(String(replay.id)).toBe(appointmentId);
  });

  test("пациент не может подтвердить запись сам", async () => {
    await status(
      await api.put(`/api/v1/appointments/${appointmentId}/status?status=CONFIRMED`, {
        headers: headers("patient"),
      }),
      403,
      "patient confirmation",
    );
  });

  test("клиника подтверждает запись", async () => {
    const confirmed = await ok(
      await api.put(`/api/v1/appointments/${appointmentId}/status?status=CONFIRMED`, {
        headers: headers("clinic_admin"),
      }),
      "clinic confirmation",
    );
    expect(confirmed.status).toBe("CONFIRMED");
  });

  test("администратор другой клиники не читает записи основной клиники", async () => {
    await status(
      await api.get(`/api/v1/appointments/clinic/${FOREIGN_CLINIC_ID}`, {
        headers: headers("clinic_admin"),
      }),
      403,
      "foreign clinic boundary",
    );
  });

  test("врач начинает визит", async () => {
    const started = await ok(
      await api.put(`/api/v1/appointments/${appointmentId}/status?status=IN_PROGRESS`, {
        headers: headers("doctor"),
      }),
      "start visit",
    );
    expect(started.status).toBe("IN_PROGRESS");
  });

  test("врач создаёт медицинский черновик", async () => {
    const record = await ok(
      await api.post("/api/v1/medical-records", {
        headers: headers("doctor"),
        data: {
          patientId: PATIENT_ID,
          clinicId: CLINIC_ID,
          appointmentId,
          diagnosis: "Sprint 15 diagnosis",
          treatment: "Sprint 15 treatment",
          notes: "Isolated localhost",
        },
      }),
      "medical draft",
    );
    medicalRecordId = String(record.id);
  });

  test("пациент не видит медицинский черновик", async () => {
    const records = await ok<Json[]>(
      await api.get(`/api/v1/medical-records/patient/${PATIENT_ID}`, {
        headers: headers("patient"),
      }),
      "draft visibility",
    );
    expect(records.some((record: Json) => String(record.id) === medicalRecordId)).toBe(false);
  });

  test("врач создаёт план лечения", async () => {
    const plan = await ok(
      await api.post("/api/v1/treatment-plans", {
        headers: headers("doctor"),
        data: {
          patientId: PATIENT_ID,
          clinicId: CLINIC_ID,
          title: "Sprint 15 treatment plan",
          description: "Real localhost visit",
          items: [{
            serviceId,
            toothNumber: 11,
            description: "Контрольное лечение",
            quantity: 1,
            unitPrice: appointmentTotal,
            stageName: "Этап 1",
            notes: "localhost",
          }],
          discountType: "PERCENT",
          discountValue: 0,
          discountComment: "Без скидки",
          patientConsentConfirmed: true,
        },
      }),
      "treatment plan",
    );
    treatmentPlanId = String(plan.id);
  });

  test("врач завершает визит и финализирует документ", async () => {
    const completed = await ok(
      await api.post("/api/v1/appointments/finish", {
        headers: headers("doctor"),
        data: {
          appointmentId,
          expectedVersion: 1,
          diagnosis: "Sprint 15 diagnosis",
          treatment: "Sprint 15 treatment",
          notes: "Isolated localhost",
        },
      }),
      "finish visit",
    );
    expect(completed.status).toBe("COMPLETED");
  });

  test("пациент видит финальный документ и план", async () => {
    const records = await ok<Json[]>(
      await api.get(`/api/v1/medical-records/patient/${PATIENT_ID}`, {
        headers: headers("patient"),
      }),
      "final medical records",
    );
    expect(records.some((record: Json) => String(record.id) === medicalRecordId)).toBe(true);
    const plans = await ok<Json[]>(
      await api.get(`/api/v1/treatment-plans/patient/${PATIENT_ID}`, {
        headers: headers("patient"),
      }),
      "patient treatment plans",
    );
    expect(plans.some((plan: Json) => String(plan.id) === treatmentPlanId)).toBe(true);
  });

  test("клиника не может выставить неверную сумму за завершённый визит", async () => {
    await status(
      await api.post(`/api/v1/crm/clinics/${CLINIC_ID}/invoices`, {
        headers: headers("clinic_admin"),
        data: {
          clientRequestId: randomUUID(),
          patientId: PATIENT_ID,
          appointmentId,
          subtotal: appointmentTotal + 1,
          discount: 0,
          tax: 0,
          notes: "Tampered total",
        },
      }),
      400,
      "tampered invoice",
    );
  });

  test("клиника создаёт счёт по серверной цене визита", async () => {
    invoiceRequestId = randomUUID();
    const invoice = await ok(
      await api.post(`/api/v1/crm/clinics/${CLINIC_ID}/invoices`, {
        headers: headers("clinic_admin"),
        data: {
          clientRequestId: invoiceRequestId,
          patientId: PATIENT_ID,
          appointmentId,
          subtotal: appointmentTotal,
          discount: 0,
          tax: 0,
          notes: "Sprint 15 completed visit",
        },
      }),
      "create invoice",
    );
    invoiceId = String(invoice.id);
    invoiceNumber = String(invoice.invoice_number);
    expect(invoice.status).toBe("SENT");
  });

  test("повтор счёта не создаёт дубль", async () => {
    const replay = await ok(
      await api.post(`/api/v1/crm/clinics/${CLINIC_ID}/invoices`, {
        headers: headers("clinic_admin"),
        data: {
          clientRequestId: invoiceRequestId,
          patientId: PATIENT_ID,
          appointmentId,
          subtotal: appointmentTotal,
          discount: 0,
          tax: 0,
          notes: "Sprint 15 completed visit",
        },
      }),
      "invoice replay",
    );
    expect(String(replay.id)).toBe(invoiceId);
  });

  test("пациент видит только свой неоплаченный счёт", async () => {
    const history = await ok<BillingHistory>(
      await api.get("/api/v1/payments/patient-history", {
        headers: headers("patient"),
      }),
      "patient invoice history",
    );
    const invoice = history.invoices.find((row: Json) => String(row.id) === invoiceId);
    expect(invoice.status).toBe("SENT");
    expect(Number(invoice.balance_due)).toBe(appointmentTotal);
    expect(history.payments.some((row) => String(row.invoice_id) === invoiceId)).toBe(false);
  });

  test("посторонний пользователь не получает счёт пациента", async () => {
    const history = await ok<BillingHistory>(
      await api.get("/api/v1/payments/patient-history", {
        headers: headers("seller"),
      }),
      "foreign billing history",
    );
    expect(history.invoices.some((row: Json) => String(row.id) === invoiceId)).toBe(false);
  });

  test("ручная оплата не принимает имя внешнего провайдера", async () => {
    await status(
      await api.post(`/api/v1/crm/clinics/${CLINIC_ID}/payments`, {
        headers: headers("accountant"),
        data: {
          clientRequestId: randomUUID(),
          invoiceId,
          amount: appointmentTotal,
          method: "PAYME",
          notes: "Unsigned provider payment",
        },
      }),
      400,
      "unsigned provider payment",
    );
  });

  test("бухгалтер фиксирует подтверждённую оплату картой", async () => {
    paymentRequestId = randomUUID();
    const payment = await ok(
      await api.post(`/api/v1/crm/clinics/${CLINIC_ID}/payments`, {
        headers: headers("accountant"),
        data: {
          clientRequestId: paymentRequestId,
          invoiceId,
          amount: appointmentTotal,
          method: "CARD",
          notes: "Sprint 15 verified local payment",
        },
      }),
      "record payment",
    );
    paymentId = String(payment.id);
    expect(payment.status).toBe("COMPLETED");
    expect(Number(payment.invoiceBalanceDue)).toBe(0);
  });

  test("повтор оплаты не создаёт вторую транзакцию", async () => {
    const replay = await ok(
      await api.post(`/api/v1/crm/clinics/${CLINIC_ID}/payments`, {
        headers: headers("accountant"),
        data: {
          clientRequestId: paymentRequestId,
          invoiceId,
          amount: appointmentTotal,
          method: "CARD",
          notes: "Sprint 15 verified local payment",
        },
      }),
      "payment replay",
    );
    expect(String(replay.id)).toBe(paymentId);
  });

  test("пациент видит оплаченный счёт и одну оплату", async () => {
    const history = await ok<BillingHistory>(
      await api.get("/api/v1/payments/patient-history", {
        headers: headers("patient"),
      }),
      "paid patient history",
    );
    const invoice = history.invoices.find((row: Json) => String(row.id) === invoiceId);
    expect(invoice.status).toBe("PAID");
    expect(Number(invoice.balance_due)).toBe(0);
    const matchingPayments = history.payments.filter(
      (row: Json) => String(row.invoice_id) === invoiceId,
    );
    expect(matchingPayments).toHaveLength(1);
    expect(matchingPayments[0].status).toBe("COMPLETED");
  });

  test("реальный кабинет пациента показывает счёт и оплату", async ({ page }) => {
    let session = sessions.get("patient");
    if (!session) {
      session = await ok(
        await api.post("/api/v1/auth/login", {
          data: { email: accounts.patient, password: PASSWORD },
        }),
        "patient UI login",
      );
      sessions.set("patient", session);
    }
    if (!invoiceNumber) {
      const history = await ok<BillingHistory>(
        await api.get("/api/v1/payments/patient-history", {
          headers: headers("patient"),
        }),
        "patient UI billing history",
      );
      const paidInvoice = history.invoices.find((row) => row.status === "PAID");
      expect(paidInvoice, "paid invoice for UI verification").toBeDefined();
      invoiceNumber = String(paidInvoice?.invoice_number);
    }
    await page.addInitScript(
      ({ accessToken, refreshToken, user }) => {
        localStorage.setItem("prodent_access_token", accessToken);
        localStorage.setItem("prodent_refresh_token", refreshToken);
        localStorage.setItem("prodent_user_profile", JSON.stringify(user));
        localStorage.setItem("language", "ru");
      },
      {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        user: session.user,
      },
    );
    await page.goto("/patient/billing");
    await page.getByRole("button", { name: /Счета/ }).click();
    const invoiceNumberCell = page.getByText(`#${invoiceNumber}`, { exact: true });
    await expect(invoiceNumberCell).toBeVisible();
    const invoiceRow = invoiceNumberCell.locator("..").locator("..");
    await expect(invoiceRow.getByText("Оплачен", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Оплаты/ }).click();
    await expect(page.getByText("CARD", { exact: true }).first()).toBeVisible();
  });
});
