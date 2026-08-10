import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const API = process.env.PRODENT_API_URL || "http://127.0.0.1:8115";
const PASSWORD = "ProdentQa2026!";
const CLINIC_ID = "c0000000-0000-0000-0000-000000000001";
const DOCTOR_ID = "d1000000-0000-0000-0000-000000000005";
const PATIENT_ID = "a1000000-0000-0000-0000-000000000006";
const TECHNICIAN_ID = "a1000000-0000-0000-0000-00000000000b";
const SUPPLIER_ID = "51000000-0000-0000-0000-00000000000a";
const PRODUCT_ID = "b6000000-0000-0000-0000-000000000001";

const accounts = {
  super_admin: "qa-super-admin@prodent.local",
  admin: "qa-admin@prodent.local",
  moderator: "qa-moderator@prodent.local",
  clinic_admin: "qa-clinic-admin@prodent.local",
  doctor: "qa-doctor@prodent.local",
  patient: "qa-patient@prodent.local",
  assistant: "qa-assistant@prodent.local",
  accountant: "qa-accountant@prodent.local",
  clinic_manager: "qa-clinic-manager@prodent.local",
  seller: "qa-seller@prodent.local",
  technician: "qa-technician@prodent.local",
} as const;

type Role = keyof typeof accounts;
// The suite intentionally validates heterogeneous responses from many API modules.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

let api: APIRequestContext;
const sessions = new Map<Role, Json>();
let serviceId = "";
let appointmentDate = "";
let appointmentStartTime = "";
let appointmentId = "";
let bookingRequestId = "";
let medicalRecordId = "";
let treatmentPlanId = "";
let treatmentPlanShareToken = "";
let inventoryItemId = "";
let labOrderId = "";
let marketOrderId = "";
let jobListingId = "";
let jobApplicationId = "";
let privateFilePath = "";
let privateFileUrl = "";
const OTHER_CLINIC_ID = "c2000000-0000-0000-0000-000000000002";

function token(role: Role) {
  const value = sessions.get(role)?.access_token;
  if (!value) throw new Error(`Нет токена роли ${role}`);
  return value as string;
}

function headers(role: Role, clinic = false) {
  return {
    Authorization: `Bearer ${token(role)}`,
    ...(clinic ? { "X-Clinic-Id": CLINIC_ID } : {}),
  };
}

async function body(response: import("@playwright/test").APIResponse) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function ok(response: import("@playwright/test").APIResponse, label: string) {
  const payload = await body(response);
  expect(response.ok(), `${label}: HTTP ${response.status()} ${JSON.stringify(payload)}`).toBeTruthy();
  return payload as Json;
}

async function denied(
  response: import("@playwright/test").APIResponse,
  expectedStatus: number,
  label: string,
) {
  const payload = await body(response);
  expect(
    response.status(),
    `${label}: HTTP ${response.status()} ${JSON.stringify(payload)}`,
  ).toBe(expectedStatus);
  return payload;
}

async function authenticatePage(page: Page, role: Role) {
  const session = sessions.get(role)!;
  await page.addInitScript(
    ({ accessToken, refreshToken, user }) => {
      localStorage.setItem("prodent_access_token", accessToken);
      localStorage.setItem("prodent_refresh_token", refreshToken);
      localStorage.setItem("prodent_user_profile", JSON.stringify(user));
      localStorage.setItem("prodent_current_clinic", "c0000000-0000-0000-0000-000000000001");
      localStorage.setItem("language", "ru");
    },
    {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: session.user,
    },
  );
}

test.describe.serial("Sprint 14 — реальный localhost full-day PRODENT", () => {
  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: API });
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test("все 11 ролей входят через настоящий backend", async () => {
    for (const [role, email] of Object.entries(accounts) as [Role, string][]) {
      const response = await api.post("/api/v1/auth/login", {
        data: { email, password: PASSWORD },
      });
      const session = await ok(response, `login ${role}`);
      expect(session.access_token).toBeTruthy();
      expect(session.user?.roles?.length).toBeGreaterThan(0);
      sessions.set(role, session);
    }
  });

  test("защищённый список записей без входа недоступен", async () => {
    await denied(
      await api.get("/api/v1/appointments/my"),
      401,
      "anonymous appointments",
    );
  });

  test("пациент не читает внутренний список клиники", async () => {
    await denied(
      await api.get(`/api/v1/appointments/clinic/${CLINIC_ID}`, {
        headers: headers("patient"),
      }),
      403,
      "patient clinic appointments",
    );
  });

  test("администратор основной клиники не читает записи другой клиники", async () => {
    await denied(
      await api.get(`/api/v1/appointments/clinic/${OTHER_CLINIC_ID}`, {
        headers: headers("clinic_admin"),
      }),
      403,
      "cross-tenant clinic appointments",
    );
  });

  test("ассистент не может делать административную рассылку", async () => {
    await denied(
      await api.post("/api/v1/notifications/admin/broadcast", {
        headers: headers("assistant"),
        data: {
          title: "Forbidden Sprint 14 broadcast",
          message: "Must never be delivered",
          role: "PATIENT",
        },
      }),
      403,
      "assistant broadcast",
    );
  });

  test("пациент находит настоящего врача и услугу", async () => {
    const doctors = await ok(
      await api.get(`/api/v1/data/doctors?id=eq.${DOCTOR_ID}&limit=1`),
      "doctor search",
    );
    expect(doctors.length).toBe(1);
    const assignments = await ok(
      await api.get(
        `/api/v1/data/clinic_doctor_services?clinic_id=eq.${CLINIC_ID}&doctor_id=eq.${DOCTOR_ID}&is_active=eq.true&limit=1`,
      ),
      "active doctor service search",
    );
    expect(assignments.length).toBeGreaterThan(0);
    serviceId = String(assignments[0].service_id);
    const nextDay = new Date();
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    appointmentDate = nextDay.toISOString().slice(0, 10);
    const availability = await ok(
      await api.get(
        `/api/v1/public/doctors/${DOCTOR_ID}/availability?clinicId=${CLINIC_ID}&serviceId=${serviceId}&date=${appointmentDate}`,
      ),
      "doctor availability",
    );
    expect(availability.slots?.length).toBeGreaterThan(0);
    appointmentStartTime = String(availability.slots[0].startTime);
  });

  test("пациент создаёт запись", async () => {
    bookingRequestId = randomUUID();
    const response = await api.post("/api/v1/appointments", {
      headers: headers("patient"),
      data: {
        doctorId: DOCTOR_ID,
        clinicId: CLINIC_ID,
        serviceId,
        appointmentDate,
        startTime: appointmentStartTime,
        notes: "Sprint 14 real localhost full-day",
        clientRequestId: bookingRequestId,
      },
    });
    const created = await ok(response, "create appointment");
    appointmentId = String(created.id);
    expect(String(created.status).toUpperCase()).toBe("PENDING");
  });

  test("повтор запроса записи возвращает ту же запись", async () => {
    const replayed = await ok(
      await api.post("/api/v1/appointments", {
        headers: headers("patient"),
        data: {
          doctorId: DOCTOR_ID,
          clinicId: CLINIC_ID,
          serviceId,
          appointmentDate,
          startTime: appointmentStartTime,
          notes: "Sprint 14 real localhost full-day",
          clientRequestId: bookingRequestId,
        },
      }),
      "appointment idempotent replay",
    );
    expect(String(replayed.id)).toBe(appointmentId);
  });

  test("вторая запись на занятый слот отклоняется", async () => {
    await denied(
      await api.post("/api/v1/appointments", {
        headers: headers("patient"),
        data: {
          doctorId: DOCTOR_ID,
          clinicId: CLINIC_ID,
          serviceId,
          appointmentDate,
          startTime: appointmentStartTime,
          notes: "Sprint 14 conflicting booking",
          clientRequestId: randomUUID(),
        },
      }),
      400,
      "appointment slot conflict",
    );
  });

  test("посторонний продавец не читает запись пациента", async () => {
    await denied(
      await api.get(`/api/v1/appointments/${appointmentId}`, {
        headers: headers("seller"),
      }),
      403,
      "foreign appointment read",
    );
  });

  test("пациент не может создать медицинскую запись врача", async () => {
    await denied(
      await api.post("/api/v1/medical-records", {
        headers: headers("patient"),
        data: {
          patientId: PATIENT_ID,
          clinicId: CLINIC_ID,
          appointmentId,
          diagnosis: "Forbidden patient-authored diagnosis",
        },
      }),
      403,
      "patient creates medical record",
    );
  });

  test("клиника подтверждает запись", async () => {
    const updated = await ok(
      await api.put(`/api/v1/appointments/${appointmentId}/status?status=CONFIRMED`, {
        headers: headers("clinic_admin"),
      }),
      "confirm appointment",
    );
    expect(String(updated.status).toUpperCase()).toBe("CONFIRMED");
  });

  test("врач начинает визит и создаёт медицинскую запись", async () => {
    await ok(
      await api.put(`/api/v1/appointments/${appointmentId}/status?status=IN_PROGRESS`, {
        headers: headers("doctor"),
      }),
      "start visit",
    );
    const record = await ok(
      await api.post("/api/v1/medical-records", {
        headers: headers("doctor"),
        data: {
          patientId: PATIENT_ID,
          clinicId: CLINIC_ID,
          appointmentId,
          diagnosis: "Sprint 14 localhost diagnosis",
          treatment: "Local deterministic treatment",
          notes: "No production data",
        },
      }),
      "create medical record",
    );
    medicalRecordId = String(record.id);
    expect(medicalRecordId).toBeTruthy();
  });

  test("повтор медицинской записи возвращает тот же документ", async () => {
    const replayed = await ok(
      await api.post("/api/v1/medical-records", {
        headers: headers("doctor"),
        data: {
          patientId: PATIENT_ID,
          clinicId: CLINIC_ID,
          appointmentId,
          diagnosis: "Sprint 14 localhost diagnosis",
          treatment: "Local deterministic treatment",
          notes: "No production data",
        },
      }),
      "medical record replay",
    );
    expect(String(replayed.id)).toBe(medicalRecordId);
  });

  test("повтор медицинской записи с другим содержимым отклоняется", async () => {
    await denied(
      await api.post("/api/v1/medical-records", {
        headers: headers("doctor"),
        data: {
          patientId: PATIENT_ID,
          clinicId: CLINIC_ID,
          appointmentId,
          diagnosis: "Conflicting diagnosis",
          treatment: "Local deterministic treatment",
          notes: "No production data",
        },
      }),
      409,
      "conflicting medical record replay",
    );
  });

  test("пациент не видит черновик медицинской записи", async () => {
    const records = await ok(
      await api.get(`/api/v1/medical-records/patient/${PATIENT_ID}`, {
        headers: headers("patient"),
      }),
      "patient draft visibility",
    );
    expect(records.some((row: Json) => String(row.id) === medicalRecordId)).toBeFalsy();
  });

  test("врач создаёт план лечения", async () => {
    const plan = await ok(
      await api.post("/api/v1/treatment-plans", {
        headers: headers("doctor"),
        data: {
          patientId: PATIENT_ID,
          clinicId: CLINIC_ID,
          title: "Sprint 14 localhost plan",
          description: "Real backend acceptance",
          items: [{
            serviceId,
            toothNumber: 11,
            description: "Контрольное лечение",
            quantity: 1,
            unitPrice: 75000,
            stageName: "Этап 1",
            notes: "localhost",
          }],
          discountType: "PERCENT",
          discountValue: 0,
          discountComment: "Без скидки",
          patientConsentConfirmed: true,
        },
      }),
      "create treatment plan",
    );
    treatmentPlanId = String(plan.id);
    expect(treatmentPlanId).toBeTruthy();
  });

  test("врач создаёт публичную ссылку плана лечения", async () => {
    const share = await ok(
      await api.post(`/api/v1/treatment-plans/${treatmentPlanId}/share-link`, {
        headers: headers("doctor"),
        data: { ttlHours: 1 },
      }),
      "create treatment plan share link",
    );
    treatmentPlanShareToken = String(share.token);
    expect(treatmentPlanShareToken.length).toBeGreaterThan(20);
  });

  test("публичная ссылка открывает только разрешённый план", async () => {
    const response = await api.post("/api/v1/public/treatment-plans/resolve", {
      data: { token: treatmentPlanShareToken },
    });
    const shared = await ok(response, "resolve treatment plan share link");
    expect(String(shared.title)).toBe("Sprint 14 localhost plan");
    expect(shared.items?.length).toBe(1);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("случайная публичная ссылка не раскрывает данные", async () => {
    await denied(
      await api.post("/api/v1/public/treatment-plans/resolve", {
        data: { token: `invalid-${randomUUID()}` },
      }),
      404,
      "invalid treatment plan share link",
    );
  });

  test("пациент не может выпускать публичные ссылки врача", async () => {
    await denied(
      await api.post(`/api/v1/treatment-plans/${treatmentPlanId}/share-link`, {
        headers: headers("patient"),
        data: { ttlHours: 1 },
      }),
      403,
      "patient creates treatment plan share link",
    );
  });

  test("врач отзывает публичную ссылку", async () => {
    const response = await api.delete(
      `/api/v1/treatment-plans/${treatmentPlanId}/share-link`,
      { headers: headers("doctor") },
    );
    await ok(response, "revoke treatment plan share link");
    expect(response.status()).toBe(204);
  });

  test("отозванная публичная ссылка больше не открывается", async () => {
    await denied(
      await api.post("/api/v1/public/treatment-plans/resolve", {
        data: { token: treatmentPlanShareToken },
      }),
      404,
      "revoked treatment plan share link",
    );
  });

  test("пациент видит разрешённые медицинские документы", async () => {
    await ok(
      await api.post("/api/v1/appointments/finish", {
        headers: headers("doctor"),
        data: {
          appointmentId,
          expectedVersion: 1,
          diagnosis: "Sprint 14 localhost diagnosis",
          treatment: "Sprint 14 verified treatment",
          notes: "Created by real backend UAT",
        },
      }),
      "finalize visit",
    );
    const records = await ok(
      await api.get(`/api/v1/medical-records/patient/${PATIENT_ID}`, {
        headers: headers("patient"),
      }),
      "patient records",
    );
    expect(records.some((row: Json) => String(row.id) === medicalRecordId)).toBeTruthy();
    const plans = await ok(
      await api.get(`/api/v1/treatment-plans/patient/${PATIENT_ID}`, {
        headers: headers("patient"),
      }),
      "patient plans",
    );
    expect(plans.some((row: Json) => String(row.id) === treatmentPlanId)).toBeTruthy();
  });

  test("повтор завершения визита безопасно возвращает финальный результат", async () => {
    const replayed = await ok(
      await api.post("/api/v1/appointments/finish", {
        headers: headers("doctor"),
        data: {
          appointmentId,
          expectedVersion: 1,
          diagnosis: "Sprint 14 localhost diagnosis",
          treatment: "Sprint 14 verified treatment",
          notes: "Created by real backend UAT",
        },
      }),
      "finish visit replay",
    );
    expect(replayed.replayed).toBe(true);
  });

  test("администратор создаёт материал, ассистент списывает, бухгалтер сверяет склад", async () => {
    const item = await ok(
      await api.post("/api/v1/sklad/items", {
        headers: headers("clinic_admin", true),
        data: {
          name: `Sprint 14 material ${randomUUID()}`,
          unit: "pcs",
          price_per_unit: 12000,
          quantity: 5,
        },
      }),
      "create inventory item",
    );
    inventoryItemId = String(item.id);
    const movement = await ok(
      await api.post(`/api/v1/sklad/items/${inventoryItemId}/stock`, {
        headers: headers("assistant", true),
        data: {
          type: "expense",
          quantity: 1,
          reason: "Sprint 14 patient visit",
          appointment_id: appointmentId,
          client_request_id: randomUUID(),
        },
      }),
      "assistant material expense",
    );
    expect(Number(movement.balance_after)).toBe(4);
    const stats = await ok(
      await api.get("/api/v1/sklad/stats", {
        headers: headers("accountant", true),
      }),
      "accountant inventory stats",
    );
    expect(stats).toBeTruthy();
  });

  test("менеджер открывает KPI-источник клиники", async () => {
    const appointments = await ok(
      await api.get(`/api/v1/appointments/clinic/${CLINIC_ID}?size=100`, {
        headers: headers("clinic_manager"),
      }),
      "manager clinic appointments",
    );
    const rows = appointments.content ?? appointments;
    expect(rows.some((row: Json) => String(row.id) === appointmentId)).toBeTruthy();
  });

  test("врач создаёт лабораторный заказ, техник выполняет, врач принимает", async () => {
    const order = await ok(
      await api.post("/api/v1/lab/orders", {
        headers: headers("doctor"),
        data: {
          technician_id: TECHNICIAN_ID,
          client_request_id: randomUUID(),
          treatment_plan_id: treatmentPlanId,
          work_type: "crown",
          material: "zirconia",
          tooth: "11",
          shade: "A2",
          priority: "normal",
          price: 250000,
          currency: "UZS",
          notes: "Sprint 14 localhost",
        },
      }),
      "create lab order",
    );
    labOrderId = String(order.id);
    await ok(
      await api.post(`/api/v1/lab/orders/${labOrderId}/accept`, {
        headers: headers("technician"),
      }),
      "technician accepts lab order",
    );
    let current: Json = {};
    for (let i = 0; i < 6; i += 1) {
      current = await ok(
        await api.post(`/api/v1/lab/orders/${labOrderId}/advance`, {
          headers: headers("technician"),
          data: { note: `Sprint 14 stage ${i + 1}` },
        }),
        `lab advance ${i + 1}`,
      );
    }
    expect(String(current.status)).toBe("ready");
    const delivered = await ok(
      await api.post(`/api/v1/lab/orders/${labOrderId}/receive`, {
        headers: headers("doctor"),
        data: { note: "Принято клиникой" },
      }),
      "clinic receives lab order",
    );
    expect(String(delivered.status)).toBe("delivered");
  });

  test("покупатель создаёт marketplace-заказ, продавец принимает, тестовый платёж создаётся", async () => {
    const order = await ok(
      await api.post("/api/v1/marketplace/orders", {
        headers: headers("clinic_admin"),
        data: {
          supplier_id: SUPPLIER_ID,
          buyer_clinic_id: CLINIC_ID,
          client_request_id: randomUUID(),
          contact_name: "Sprint 14 Buyer",
          contact_phone: "+998900001414",
          delivery_address: "Localhost",
          currency: "UZS",
          items: [{ product_id: PRODUCT_ID, quantity: 1 }],
        },
      }),
      "create marketplace order",
    );
    marketOrderId = String(order.id);
    await ok(
      await api.patch(`/api/v1/marketplace/orders/${marketOrderId}`, {
        headers: headers("seller"),
        data: { status: "accepted" },
      }),
      "seller accepts order",
    );
    await ok(
      await api.patch(`/api/v1/marketplace/orders/${marketOrderId}`, {
        headers: headers("seller"),
        data: { status: "awaiting_payment" },
      }),
      "seller awaits payment",
    );
    const payment = await ok(
      await api.post(`/api/v1/marketplace/orders/${marketOrderId}/pay`, {
        headers: headers("clinic_admin"),
        data: { method: "test", request_id: randomUUID() },
      }),
      "create safe test payment",
    );
    expect(["pending", "paid"]).toContain(String(payment.status));
  });

  test("клиника публикует вакансию, пациент откликается, стороны проходят найм", async () => {
    const listing = await ok(
      await api.post("/api/v1/jobs/listings", {
        headers: headers("clinic_admin"),
        data: {
          listing_type: "vacancy",
          category: "dental_assistant",
          title: `Sprint 14 vacancy ${randomUUID()}`,
          description: "Real localhost full-day",
          cooperation_type: "staff_doctor",
          salary_mode: "fixed",
          salary_min: 8000000,
          status: "published",
          contact_name: "QA Clinic",
          contact_phone: "+998900001414",
        },
      }),
      "create job listing",
    );
    jobListingId = String(listing.id);
    await ok(
      await api.put("/api/v1/jobs/resume", {
        headers: headers("patient"),
        data: {
          category: "dental_assistant",
          headline: "Sprint 14 candidate",
          visibility: "public",
          is_open_to_work: true,
          contact_phone: "+998900001415",
        },
      }),
      "upsert resume",
    );
    const application = await ok(
      await api.post("/api/v1/jobs/applications", {
        headers: headers("patient"),
        data: { listing_id: jobListingId, cover_message: "Готов к собеседованию" },
      }),
      "apply to listing",
    );
    jobApplicationId = String(application.id);
    for (const status of ["viewed", "shortlisted", "interview", "offer"]) {
      await ok(
        await api.patch(`/api/v1/jobs/applications/${jobApplicationId}`, {
          headers: headers("clinic_admin"),
          data: { status },
        }),
        `job transition ${status}`,
      );
    }
    const accepted = await ok(
      await api.patch(`/api/v1/jobs/applications/${jobApplicationId}`, {
        headers: headers("patient"),
        data: { status: "accepted" },
      }),
      "candidate accepts offer",
    );
    expect(String(accepted.status)).toBe("accepted");
  });

  test("администратор рассылает уведомление, пациент получает и читает", async () => {
    await ok(
      await api.post("/api/v1/notifications/admin/broadcast", {
        headers: headers("super_admin"),
        data: {
          title: "Sprint 14 localhost",
          message: "Full-day acceptance notification",
          role: "PATIENT",
        },
      }),
      "admin broadcast",
    );
    const notifications = await ok(
      await api.get("/api/v1/notifications", { headers: headers("patient") }),
      "patient notifications",
    );
    const row = notifications.content?.find(
      (item: Json) => item.title === "Sprint 14 localhost",
    );
    expect(row).toBeTruthy();
    await ok(
      await api.put(`/api/v1/notifications/${row.id}/read`, {
        headers: headers("patient"),
      }),
      "read notification",
    );
  });

  test("пациент загружает приватный текстовый документ", async () => {
    privateFilePath = `${PATIENT_ID}/sprint14-${randomUUID()}.txt`;
    const uploaded = await ok(
      await api.post("/api/v1/storage/documents/upload", {
        headers: headers("patient"),
        multipart: {
          file: {
            name: "sprint14.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Sprint 14 private localhost document", "utf8"),
          },
          path: privateFilePath,
        },
      }),
      "upload private document",
    );
    privateFileUrl = String(uploaded.publicUrl);
    expect(privateFileUrl).toContain(privateFilePath);
  });

  test("повторная загрузка по тому же пути отклоняется", async () => {
    await denied(
      await api.post("/api/v1/storage/documents/upload", {
        headers: headers("patient"),
        multipart: {
          file: {
            name: "sprint14.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Duplicate content", "utf8"),
          },
          path: privateFilePath,
        },
      }),
      409,
      "duplicate private document",
    );
  });

  test("владелец скачивает свой приватный документ", async () => {
    const response = await api.get(privateFileUrl, { headers: headers("patient") });
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe("Sprint 14 private localhost document");
  });

  test("приватный документ без входа недоступен", async () => {
    await denied(
      await api.get(privateFileUrl),
      401,
      "anonymous private document download",
    );
  });

  test("чужой продавец не читает приватный документ пациента", async () => {
    await denied(
      await api.get(privateFileUrl, { headers: headers("seller") }),
      403,
      "foreign private document download",
    );
  });

  test("чужой продавец не удаляет приватный документ пациента", async () => {
    await denied(
      await api.delete(privateFileUrl, { headers: headers("seller") }),
      403,
      "foreign private document delete",
    );
  });

  test("файл нельзя загрузить в путь другого пользователя", async () => {
    await denied(
      await api.post("/api/v1/storage/documents/upload", {
        headers: headers("patient"),
        multipart: {
          file: {
            name: "foreign.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Forbidden path", "utf8"),
          },
          path: `${DOCTOR_ID}/foreign-${randomUUID()}.txt`,
        },
      }),
      403,
      "foreign upload path",
    );
  });

  test("запрещённый тип файла не загружается", async () => {
    await denied(
      await api.post("/api/v1/storage/documents/upload", {
        headers: headers("patient"),
        multipart: {
          file: {
            name: "unsafe.exe",
            mimeType: "application/x-msdownload",
            buffer: Buffer.from("MZ", "utf8"),
          },
          path: `${PATIENT_ID}/unsafe-${randomUUID()}.exe`,
        },
      }),
      415,
      "unsupported private file",
    );
  });

  test("владелец удаляет свой приватный документ", async () => {
    const deleted = await ok(
      await api.delete(privateFileUrl, { headers: headers("patient") }),
      "owner private document delete",
    );
    expect(deleted.removed).toBe(true);
  });

  test("удалённый приватный документ больше не открывается", async () => {
    await denied(
      await api.get(privateFileUrl, { headers: headers("patient") }),
      404,
      "deleted private document",
    );
  });

  test("реальный frontend открывает кабинеты на данных backend", async ({ page }) => {
    const checks: [Role, string][] = [
      ["patient", "/patient/history"],
      ["doctor", "/doctor/treatment-plans"],
      ["assistant", "/assistant/materials"],
      ["accountant", "/accountant/reports"],
      ["clinic_manager", "/manager/kpi"],
      ["technician", "/technician"],
      ["seller", "/seller/orders"],
      ["super_admin", "/admin/verification"],
    ];
    for (const [role, route] of checks) {
      await page.context().clearCookies();
      await authenticatePage(page, role);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect.poll(() => new URL(page.url()).pathname).toBe(route);
      await expect(page.locator("#root")).toBeVisible();
    }
  });
});
