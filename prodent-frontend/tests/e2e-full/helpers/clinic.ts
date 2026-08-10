import { expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { API_URL } from "./stand";

/**
 * Общие координаты QA-клиники и короткие обёртки над API.
 *
 * Данные приходят из сидов `ops/seed-sprint-01-*.sql` + `ops/sprint-14/seed-full-day.sql`:
 * одна работающая клиника, один врач в ней, пациент и остальные девять ролей.
 */

export const CLINIC_ID = "c0000000-0000-0000-0000-000000000001";
export const OTHER_CLINIC_ID = "c2000000-0000-0000-0000-000000000002";
export const DOCTOR_ID = "d1000000-0000-0000-0000-000000000005";
export const PATIENT_ID = "a1000000-0000-0000-0000-000000000006";
export const QA_PASSWORD = "ProdentQa2026!";

export const ACCOUNTS = {
  superAdmin: "qa-super-admin@prodent.local",
  admin: "qa-admin@prodent.local",
  moderator: "qa-moderator@prodent.local",
  clinicAdmin: "qa-clinic-admin@prodent.local",
  clinicManager: "qa-clinic-manager@prodent.local",
  accountant: "qa-accountant@prodent.local",
  assistant: "qa-assistant@prodent.local",
  doctor: "qa-doctor@prodent.local",
  seller: "qa-seller@prodent.local",
  technician: "qa-technician@prodent.local",
  patient: "qa-patient@prodent.local",
} as const;

export type AccountKey = keyof typeof ACCOUNTS;

/** Тонкая обёртка: держит токены ролей и умеет ходить от их имени. */
export class ClinicApi {
  private readonly tokens = new Map<string, string>();

  private constructor(readonly request: APIRequestContext) {}

  static async create(): Promise<ClinicApi> {
    return new ClinicApi(await playwrightRequest.newContext({ baseURL: API_URL }));
  }

  async dispose(): Promise<void> {
    await this.request.dispose();
  }

  async login(...keys: AccountKey[]): Promise<void> {
    for (const key of keys) {
      const email = ACCOUNTS[key];
      const response = await this.request.post("/api/v1/auth/login", {
        data: { email, password: QA_PASSWORD },
      });
      expect(response.ok(), `вход ${email}: HTTP ${response.status()}`).toBeTruthy();
      this.tokens.set(key, (await response.json()).access_token as string);
    }
  }

  headers(key: AccountKey, withClinic = false): Record<string, string> {
    const token = this.tokens.get(key);
    if (!token) throw new Error(`Нет токена роли ${key} — сначала login()`);
    return {
      Authorization: `Bearer ${token}`,
      ...(withClinic ? { "X-Clinic-Id": CLINIC_ID } : {}),
    };
  }

  /** Услуга, назначенная QA-врачу в QA-клинике. */
  async serviceId(): Promise<string> {
    const response = await this.request.get(
      `/api/v1/data/clinic_doctor_services?clinic_id=eq.${CLINIC_ID}&doctor_id=eq.${DOCTOR_ID}&is_active=eq.true&limit=1`,
      { headers: this.headers("patient") },
    );
    expect(response.ok(), "услуги врача").toBeTruthy();
    const rows = await response.json();
    expect(rows.length, "у QA-врача должна быть активная услуга").toBeGreaterThan(0);
    return String(rows[0].service_id);
  }

  async slots(serviceId: string, date: string): Promise<string[]> {
    const response = await this.request.get(
      `/api/v1/public/doctors/${DOCTOR_ID}/availability?clinicId=${CLINIC_ID}&serviceId=${serviceId}&date=${date}`,
    );
    if (!response.ok()) return [];
    const body = await response.json();
    return (body.slots ?? []).map((slot: { startTime: string }) => slot.startTime);
  }

  /**
   * Свободный день далеко вперёд: сидовые записи стоят рядом с сегодняшней
   * датой, поэтому тесты уходят на две недели вперёд и не мешают им.
   */
  async findFreeDate(serviceId: string, minSlots = 2, from = 10, to = 24) {
    for (let offset = from; offset <= to; offset += 1) {
      const candidate = new Date();
      candidate.setDate(candidate.getDate() + offset);
      const date = candidate.toISOString().slice(0, 10);
      const slots = await this.slots(serviceId, date);
      if (slots.length >= minSlots) return { date, slots };
    }
    throw new Error("не нашёлся свободный день у QA-врача");
  }

  async createAppointment(serviceId: string, date: string, startTime: string, notes = "E2E"): Promise<string> {
    const response = await this.request.post("/api/v1/appointments", {
      headers: this.headers("patient"),
      data: {
        doctorId: DOCTOR_ID,
        clinicId: CLINIC_ID,
        serviceId,
        appointmentDate: date,
        startTime,
        notes,
        clientRequestId: randomUUID(),
      },
    });
    expect(
      response.ok(),
      `создание записи: HTTP ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
    return String((await response.json()).id);
  }

  async setStatus(appointmentId: string, status: string, actor: AccountKey): Promise<void> {
    const response = await this.request.post("/api/v1/appointments/commands/status", {
      headers: this.headers(actor, true),
      data: { appointmentId, status },
    });
    expect(
      response.ok(),
      `статус ${status}: HTTP ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
  }
}
