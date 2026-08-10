import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "ProdentQa2026!";
const PATIENT_EMAIL = "qa-patient@prodent.local";
const LOCAL_BACKEND = "http://127.0.0.1:8116";
const DOCTOR_WITH_CLINIC = "d1000000-0000-0000-0000-000000000005";
const UNBOOKABLE_DOCTOR = "139164fe-f7db-4a64-8f6a-94779e15e8a9";
const DEMO_CLINIC = "c0000000-0000-0000-0000-000000000001";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; roles?: string[] };
};

let patientSession: LoginResponse | null = process.env.SPRINT15_PATIENT_SESSION
  ? (JSON.parse(process.env.SPRINT15_PATIENT_SESSION) as LoginResponse)
  : null;

async function getPatientSession(request: APIRequestContext): Promise<LoginResponse> {
  if (patientSession) return patientSession;
  const response = await request.post(`${LOCAL_BACKEND}/api/v1/auth/login`, {
    data: { email: PATIENT_EMAIL, password: PASSWORD },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  patientSession = (await response.json()) as LoginResponse;
  return patientSession;
}

async function authenticatePatient(page: Page): Promise<void> {
  const session = await getPatientSession(page.request);
  await page.addInitScript((value) => {
    localStorage.setItem("prodent_access_token", value.access_token);
    localStorage.setItem("prodent_refresh_token", value.refresh_token);
    localStorage.setItem("prodent_user_profile", JSON.stringify(value.user));
    localStorage.setItem("language", "ru");
    localStorage.setItem("theme", "light");
  }, session);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("prodent_access_token");
    localStorage.removeItem("prodent_refresh_token");
    localStorage.removeItem("prodent_user_profile");
    localStorage.setItem("language", "ru");
    localStorage.setItem("theme", "light");
  });
});

test("real login returns the patient to search", async ({ page }) => {
  await page.route("**/api/v1/auth/login", async (route) => {
    const session = await getPatientSession(page.request);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
    });
  });
  await page.goto("/auth?returnTo=%2Fsearch", { waitUntil: "domcontentloaded" });
  await page.getByTestId("auth-login-identifier").fill(PATIENT_EMAIL);
  await page.getByTestId("auth-login-password").fill(PASSWORD);
  await page.getByTestId("auth-login-submit").click();

  await expect.poll(() => new URL(page.url()).pathname).toBe("/search");
  await expect(page.locator("main")).toBeVisible();
});

test("search opens a real doctor profile and its booking form", async ({ page }) => {
  await authenticatePatient(page);
  await page.goto("/search?q=QA%20Doctor", { waitUntil: "domcontentloaded" });

  const card = page.getByTestId("doctor-card").filter({ hasText: "QA Doctor" });
  await expect(card).toHaveCount(1);
  await card.locator(`a[href="/doctor/${DOCTOR_WITH_CLINIC}"]`).first().click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/doctor/${DOCTOR_WITH_CLINIC}`);
  await expect(page.getByText("QA Doctor", { exact: true }).first()).toBeVisible();

  const bookingLink = page.locator(`a[href="/book/${DOCTOR_WITH_CLINIC}"]:visible`).first();
  await expect(bookingLink).toBeVisible();
  await bookingLink.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/book/${DOCTOR_WITH_CLINIC}`);
  await expect(page.getByText("QA Doctor", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("booking-service-option").first()).toBeVisible();
});

test("an unavailable doctor never advertises an impossible booking", async ({
  page,
}) => {
  await page.goto(`/doctor/${UNBOOKABLE_DOCTOR}`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/doctor/${UNBOOKABLE_DOCTOR}`);
  await expect(page.locator(`a[href="/book/${UNBOOKABLE_DOCTOR}"]`)).toHaveCount(0);
});

test("real clinic profile exposes only its verified doctors", async ({ page }) => {
  await page.goto(`/clinic/${DEMO_CLINIC}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("PRODENT Demo Clinic", { exact: true }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Врачи" }).click();
  const doctorLink = page.locator(`a[href="/doctor/${DOCTOR_WITH_CLINIC}"]`);
  await expect(doctorLink).toBeVisible();
  await doctorLink.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/doctor/${DOCTOR_WITH_CLINIC}`);
  await expect(page.getByText("QA Doctor", { exact: true }).first()).toBeVisible();
});
