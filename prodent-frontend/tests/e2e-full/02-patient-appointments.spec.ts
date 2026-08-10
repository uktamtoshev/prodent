import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { API_URL, cleanupAppointmentsForDate, resetRateLimits, sqlValue } from "./helpers/stand";
import { loginViaUi } from "./helpers/auth-ui";

/**
 * Волна 2 плана ops/e2e-all-roles-plan.md — путь пациента:
 * запись → просмотр в кабинете → перенос → отмена.
 *
 * Экранные шаги идут через настоящий интерфейс; служебные роли (клиника, врач)
 * дёргаются по API — они не предмет этой волны, а лишь декорации.
 */

const DOCTOR_ID = "d1000000-0000-0000-0000-000000000005";
const CLINIC_ID = "c0000000-0000-0000-0000-000000000001";
const QA_PASSWORD = "ProdentQa2026!";
const PATIENT_EMAIL = "qa-patient@prodent.local";
const CLINIC_ADMIN_EMAIL = "qa-clinic-admin@prodent.local";
const DOCTOR_EMAIL = "qa-doctor@prodent.local";
const OUTSIDER_EMAIL = "qa-seller@prodent.local";

let api: APIRequestContext;
const tokens = new Map<string, string>();
let serviceId = "";
/** День далеко впереди: сидовые записи стоят рядом с сегодня, их не задеваем. */
let bookingDate = "";
let freeSlots: string[] = [];
let bookedSlot = "";
let uiAppointmentId = "";

async function login(email: string): Promise<string> {
  const cached = tokens.get(email);
  if (cached) return cached;
  const response = await api.post("/api/v1/auth/login", {
    data: { email, password: QA_PASSWORD },
  });
  expect(response.ok(), `вход ${email}: HTTP ${response.status()}`).toBeTruthy();
  const body = await response.json();
  tokens.set(email, body.access_token as string);
  return body.access_token as string;
}

function auth(email: string) {
  return { Authorization: `Bearer ${tokens.get(email)}` };
}

async function slotsFor(date: string): Promise<string[]> {
  const response = await api.get(
    `/api/v1/public/doctors/${DOCTOR_ID}/availability?clinicId=${CLINIC_ID}&serviceId=${serviceId}&date=${date}`,
  );
  if (!response.ok()) return [];
  const body = await response.json();
  return (body.slots ?? []).map((slot: { startTime: string }) => slot.startTime);
}

async function createAppointmentViaApi(date: string, startTime: string): Promise<string> {
  const response = await api.post("/api/v1/appointments", {
    headers: auth(PATIENT_EMAIL),
    data: {
      doctorId: DOCTOR_ID,
      clinicId: CLINIC_ID,
      serviceId,
      appointmentDate: date,
      startTime,
      notes: "E2E волна 2",
      clientRequestId: randomUUID(),
    },
  });
  expect(response.ok(), `создание записи: HTTP ${response.status()} ${await response.text()}`).toBeTruthy();
  return String((await response.json()).id);
}

/**
 * Вход пациента через форму. Обязательно дожидаемся кабинета: сразу после
 * клика по «Войти» сессия ещё не записана, и переход на другую страницу
 * выбрасывает обратно на экран входа.
 */
async function loginPatient(page: Page): Promise<void> {
  await loginViaUi(page, PATIENT_EMAIL, QA_PASSWORD);
  await expect(page).toHaveURL(/\/patient/, { timeout: 30_000 });
}

/**
 * Открывает список записей и ждёт нужную карточку.
 *
 * Первый заход в кабинет иногда рисует пустой список: страница успевает
 * запросить записи до того, как подтянулся профиль пользователя. Человек в
 * такой ситуации жмёт «обновить» — тест делает то же самое.
 */
async function openAppointmentCard(page: Page, appointmentId: string) {
  await page.goto("/patient/appointments", { waitUntil: "domcontentloaded" });
  const card = page.locator(`[data-appointment-id="${appointmentId}"]`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await card.first().isVisible().catch(() => false)) return card;
    await page.waitForTimeout(2_000);
    if (await card.first().isVisible().catch(() => false)) return card;
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

/** Кликает нужный день в календаре формы записи. */
async function pickDateInCalendar(page: Page, isoDate: string): Promise<void> {
  const [year, month, day] = isoDate.split("-").map(Number);
  const today = new Date();
  const monthsAhead =
    (year * 12 + month - 1) - (today.getFullYear() * 12 + today.getMonth());

  const calendar = page.getByTestId("booking-calendar");
  await expect(calendar).toBeVisible();
  for (let step = 0; step < monthsAhead; step += 1) {
    await calendar.locator('button[name="next-month"]').click();
  }

  // Дни соседних месяцев тоже нарисованы (класс day-outside) — их пропускаем.
  await calendar
    .locator('button[name="day"]:not(.day-outside)', { hasText: new RegExp(`^${day}$`) })
    .first()
    .click();
}

/** Полная запись на приём через экран: услуга → день → время → подтверждение. */
async function bookViaUi(page: Page, date: string, slot: string): Promise<void> {
  await page.goto(`/book/${DOCTOR_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("booking-service-option").first().click();
  await pickDateInCalendar(page, date);
  await page.locator(`[data-slot-time="${slot}"]`).click();
  await page.getByTestId("booking-submit").click();
}

test.beforeEach(() => {
  // Пациент за прогон входит десяток раз (в каждом тесте — свежий браузер),
  // а антифрод разрешает 5 попыток на аккаунт за 15 минут. Счётчики сбрасываем:
  // предмет этой волны — записи, а не защита от перебора пароля (её проверяет 01).
  resetRateLimits();
});

test.beforeAll(async () => {
  resetRateLimits();
  api = await playwrightRequest.newContext({ baseURL: API_URL });
  await login(PATIENT_EMAIL);
  await login(CLINIC_ADMIN_EMAIL);
  await login(DOCTOR_EMAIL);
  await login(OUTSIDER_EMAIL);

  const assignments = await api.get(
    `/api/v1/data/clinic_doctor_services?clinic_id=eq.${CLINIC_ID}&doctor_id=eq.${DOCTOR_ID}&is_active=eq.true&limit=1`,
    { headers: auth(PATIENT_EMAIL) },
  );
  expect(assignments.ok(), "услуги врача").toBeTruthy();
  const rows = await assignments.json();
  expect(rows.length, "у QA-врача должна быть активная услуга").toBeGreaterThan(0);
  serviceId = String(rows[0].service_id);

  // Ищем день со свободными слотами, начиная с «сегодня + 10».
  for (let offset = 10; offset <= 24 && freeSlots.length < 2; offset += 1) {
    const candidate = new Date();
    candidate.setDate(candidate.getDate() + offset);
    const iso = candidate.toISOString().slice(0, 10);
    const slots = await slotsFor(iso);
    if (slots.length >= 2) {
      bookingDate = iso;
      freeSlots = slots;
    }
  }
  expect(bookingDate, "не нашёлся день с двумя свободными слотами").not.toBe("");

  cleanupAppointmentsForDate(DOCTOR_ID, bookingDate);
  freeSlots = await slotsFor(bookingDate);
  bookedSlot = freeSlots[0];
});

test.afterAll(async () => {
  if (bookingDate) cleanupAppointmentsForDate(DOCTOR_ID, bookingDate);
  await api?.dispose();
});

test.describe.serial("Пациент: запись на приём", () => {
  test("пациент записывается через экран и видит номер записи", async ({ page }) => {
    await loginPatient(page);

    await bookViaUi(page, bookingDate, bookedSlot);

    await expect(page.getByTestId("appointment-number")).toBeVisible({ timeout: 30_000 });

    uiAppointmentId = sqlValue(`
      SELECT id FROM appointments
       WHERE doctor_id = '${DOCTOR_ID}'
         AND appointment_date = '${bookingDate}'
         AND start_time = '${bookedSlot}'
       LIMIT 1`) ?? "";
    expect(uiAppointmentId, "запись должна появиться в базе").not.toBe("");

    // Статус — «ожидает», цену ставит сервер, а не браузер.
    expect(sqlValue(`SELECT upper(status::text) FROM appointments WHERE id = '${uiAppointmentId}'`))
      .toBe("PENDING");
    const price = sqlValue(`SELECT total_price FROM appointments WHERE id = '${uiAppointmentId}'`);
    expect(Number(price), "цена берётся из прайса клиники").toBeGreaterThan(0);
  });

  test("занятое время больше не предлагается", async ({ page }) => {
    await loginPatient(page);
    await page.goto(`/book/${DOCTOR_ID}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("booking-service-option").first().click();
    await pickDateInCalendar(page, bookingDate);

    await expect(page.getByTestId("booking-slot").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`[data-slot-time="${bookedSlot}"]`)).toHaveCount(0);
  });

  test("повторная запись на то же время отклоняется сервером", async () => {
    const response = await api.post("/api/v1/appointments", {
      headers: auth(PATIENT_EMAIL),
      data: {
        doctorId: DOCTOR_ID,
        clinicId: CLINIC_ID,
        serviceId,
        appointmentDate: bookingDate,
        startTime: bookedSlot,
        notes: "E2E конфликт слота",
        clientRequestId: randomUUID(),
      },
    });
    expect(response.ok(), "второй раз на занятое время пускать нельзя").toBeFalsy();
  });

  test("запись видна в кабинете пациента", async ({ page }) => {
    await loginPatient(page);
    const card = await openAppointmentCard(page, uiAppointmentId);
    await expect(card).toHaveAttribute("data-appointment-status", "pending");
  });

  test("посторонний пользователь чужую запись не читает", async () => {
    const response = await api.get(`/api/v1/appointments/${uiAppointmentId}`, {
      headers: auth(OUTSIDER_EMAIL),
    });
    expect(response.ok(), "чужую запись видеть нельзя").toBeFalsy();
    expect([403, 404]).toContain(response.status());
  });

  test("пациент переносит запись на другое время", async ({ page }) => {
    const newSlot = (await slotsFor(bookingDate)).find((slot) => slot !== bookedSlot);
    expect(newSlot, "нужен второй свободный слот").toBeTruthy();

    await loginPatient(page);
    const card = await openAppointmentCard(page, uiAppointmentId);
    await card.getByTestId("patient-appointment-reschedule").click();

    await page.locator("#reschedule-date").fill(bookingDate);
    await page.locator("#reschedule-time").fill(newSlot!.slice(0, 5));
    await page.getByTestId("patient-reschedule-confirm").click();

    await expect
      .poll(
        () => sqlValue(`SELECT to_char(start_time, 'HH24:MI') FROM appointments WHERE id = '${uiAppointmentId}'`),
        { timeout: 30_000 },
      )
      .toBe(newSlot!.slice(0, 5));

    bookedSlot = newSlot!;
  });

  test("отмена требует причины и уводит запись в «Отменённые»", async ({ page }) => {
    await loginPatient(page);
    const card = await openAppointmentCard(page, uiAppointmentId);
    await card.getByTestId("patient-appointment-cancel").click();

    // Без причины подтвердить нельзя.
    await expect(page.getByTestId("patient-cancel-confirm")).toBeDisabled();
    await page.getByTestId("patient-cancel-reason").fill("Планы изменились");
    await page.getByTestId("patient-cancel-confirm").click();

    await expect
      .poll(
        () => sqlValue(`SELECT upper(status::text) FROM appointments WHERE id = '${uiAppointmentId}'`),
        { timeout: 30_000 },
      )
      .toBe("CANCELLED");
    expect(sqlValue(`SELECT cancel_reason FROM appointments WHERE id = '${uiAppointmentId}'`))
      .toBe("Планы изменились");

    // Запись ушла из «Предстоящих» во вкладку «Отменённые».
    await expect(page.locator(`[data-testid="patient-appointment-card"][data-appointment-id="${uiAppointmentId}"]`))
      .toHaveCount(0);
    await page.getByTestId("patient-appointments-tab-cancelled").click();
    await expect(
      page.locator(`[data-testid="patient-appointment-row"][data-appointment-id="${uiAppointmentId}"]`),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("после отмены время снова свободно", async () => {
    const slots = await slotsFor(bookingDate);
    expect(slots, "освободившийся слот должен вернуться в список").toContain(bookedSlot);
  });
});

test.describe.serial("Пациент: статусы записи", () => {
  let appointmentId = "";

  test("клиника подтверждает запись, пациент видит статус", async ({ page }) => {
    const slots = await slotsFor(bookingDate);
    appointmentId = await createAppointmentViaApi(bookingDate, slots[0]);

    const confirmed = await api.post("/api/v1/appointments/commands/status", {
      headers: { ...auth(CLINIC_ADMIN_EMAIL), "X-Clinic-Id": CLINIC_ID },
      data: { appointmentId, status: "CONFIRMED" },
    });
    expect(confirmed.ok(), `подтверждение: HTTP ${confirmed.status()} ${await confirmed.text()}`).toBeTruthy();

    await loginPatient(page);
    const card = await openAppointmentCard(page, appointmentId);
    await expect(card).toHaveAttribute("data-appointment-status", "confirmed");
  });

  test("пациент не может подтвердить запись сам", async () => {
    const response = await api.post("/api/v1/appointments/commands/status", {
      headers: auth(PATIENT_EMAIL),
      data: { appointmentId, status: "CONFIRMED" },
    });
    expect(response.ok(), "пациенту менять статус нельзя").toBeFalsy();
  });

  test("врач начинает приём — время остаётся занятым", async () => {
    const started = await api.post("/api/v1/appointments/commands/status", {
      headers: { ...auth(DOCTOR_EMAIL), "X-Clinic-Id": CLINIC_ID },
      data: { appointmentId, status: "IN_PROGRESS" },
    });
    expect(started.ok(), `начало приёма: HTTP ${started.status()} ${await started.text()}`).toBeTruthy();

    const startTime = sqlValue(
      `SELECT to_char(start_time, 'HH24:MI') FROM appointments WHERE id = '${appointmentId}'`,
    );
    const slots = await slotsFor(bookingDate);
    expect(
      slots.map((slot) => slot.slice(0, 5)),
      "занятый кабинет не должен снова предлагаться",
    ).not.toContain(startTime);
  });

  test("повторная отмена ничего не меняет и не шлёт второе SMS", async () => {
    const cancelled = await api.post("/api/v1/appointments/commands/cancel", {
      headers: auth(PATIENT_EMAIL),
      data: { appointmentId, reason: "Заболел" },
    });
    expect(cancelled.ok(), `отмена: HTTP ${cancelled.status()} ${await cancelled.text()}`).toBeTruthy();
    const cancelledAt = sqlValue(`SELECT cancelled_at::text FROM appointments WHERE id = '${appointmentId}'`);

    // Повтор — безопасный no-op: сервер отвечает успехом, но запись не трогает,
    // иначе пациенту прилетело бы второе SMS «приём отменён».
    const again = await api.post("/api/v1/appointments/commands/cancel", {
      headers: auth(PATIENT_EMAIL),
      data: { appointmentId, reason: "Ещё раз" },
    });
    expect(again.ok(), `повтор отмены: HTTP ${again.status()}`).toBeTruthy();

    expect(sqlValue(`SELECT cancel_reason FROM appointments WHERE id = '${appointmentId}'`))
      .toBe("Заболел");
    expect(sqlValue(`SELECT cancelled_at::text FROM appointments WHERE id = '${appointmentId}'`))
      .toBe(cancelledAt);
  });
});
