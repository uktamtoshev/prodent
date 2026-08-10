import { request, type FullConfig } from "@playwright/test";

const LOCAL_BACKEND = "http://127.0.0.1:8116";
const PATIENT_EMAIL = "qa-patient@prodent.local";
const PASSWORD = "ProdentQa2026!";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const context = await request.newContext();
  try {
    const response = await context.post(`${LOCAL_BACKEND}/api/v1/auth/login`, {
      data: { email: PATIENT_EMAIL, password: PASSWORD },
      timeout: 60_000,
    });
    if (!response.ok()) {
      throw new Error(`Sprint 15 session bootstrap failed with HTTP ${response.status()}`);
    }
    process.env.SPRINT15_PATIENT_SESSION = JSON.stringify(await response.json());
  } finally {
    await context.dispose();
  }
}
