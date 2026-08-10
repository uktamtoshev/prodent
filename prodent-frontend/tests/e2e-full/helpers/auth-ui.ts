import { expect, type Page } from "@playwright/test";
import { latestOtpCode } from "./stand";

/**
 * Работа с экраном входа/регистрации так, как это делает человек: клики по
 * настоящим кнопкам, ввод в настоящие поля. Токены в localStorage не кладём —
 * иначе тест проходит мимо всей вёрстки, роутинга и гвардов.
 */

export type RegistrationRole = "patient" | "doctor" | "clinic" | "technician" | "supplier";

export interface RegistrationData {
  role: RegistrationRole;
  phone: string;
  password: string;
  /** Для клиники и поставщика — название организации. */
  orgName?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  /** Снять галочку согласия — для негативной проверки. */
  skipConsent?: boolean;
}

const STAFF_ROLES: RegistrationRole[] = ["doctor", "clinic", "technician", "supplier"];
const ORG_ROLES: RegistrationRole[] = ["clinic", "supplier"];

export async function openAuth(page: Page, tab: "login" | "register" = "register"): Promise<void> {
  await page.goto("/auth");
  await page.getByTestId(tab === "register" ? "auth-register-tab" : "auth-login-tab").click();
}

/** Заполняет форму регистрации, но НЕ отправляет её. */
export async function fillRegistrationForm(page: Page, data: RegistrationData): Promise<void> {
  const isStaff = STAFF_ROLES.includes(data.role);
  await page.getByTestId(isStaff ? "auth-category-staff" : "auth-category-patient").click();
  if (isStaff) {
    await page.getByTestId(`auth-role-${data.role}`).click();
  }

  if (ORG_ROLES.includes(data.role)) {
    await page.getByTestId("auth-register-org-name").fill(data.orgName ?? "Тестовая организация");
  } else {
    await page.getByTestId("auth-register-last-name").fill(data.lastName ?? "Тестов");
    await page.getByTestId("auth-register-first-name").fill(data.firstName ?? "Тест");
    if (data.middleName) {
      await page.getByTestId("auth-register-middle-name").fill(data.middleName);
    }
  }

  await page.getByTestId("auth-register-phone").fill(data.phone);
  await page.getByTestId("auth-register-password").fill(data.password);
  await page.getByTestId("auth-register-confirm-password").fill(data.password);
  if (!data.skipConsent) {
    await page.getByTestId("auth-register-legal-consent").click();
  }
}

/** Отправляет форму и ждёт шаг ввода кода. */
export async function submitRegistrationForm(page: Page): Promise<void> {
  await page.getByTestId("auth-register-submit").click();
  await expect(page.getByTestId("auth-otp-0")).toBeVisible({ timeout: 30_000 });
}

/** Вводит шесть цифр кода и подтверждает. */
export async function enterOtp(page: Page, code: string): Promise<void> {
  expect(code, "код должен быть из шести цифр").toMatch(/^\d{6}$/);
  for (let index = 0; index < 6; index += 1) {
    await page.getByTestId(`auth-otp-${index}`).fill(code[index]);
  }
  await page.getByTestId("auth-otp-submit").click();
}

/**
 * Полная регистрация через экран: форма → код из «SMS» → подтверждение.
 * Возвращает введённый код, чтобы тест мог проверить повторное использование.
 */
export async function registerViaUi(page: Page, data: RegistrationData): Promise<string> {
  await openAuth(page, "register");
  await fillRegistrationForm(page, data);
  await submitRegistrationForm(page);
  const code = latestOtpCode(data.phone, "REGISTRATION");
  await enterOtp(page, code);
  return code;
}

/** Вход по телефону/почте и паролю через форму. */
export async function loginViaUi(page: Page, identifier: string, password: string): Promise<void> {
  await openAuth(page, "login");
  await page.getByTestId("auth-login-identifier").fill(identifier);
  await page.getByTestId("auth-login-password").fill(password);
  await page.getByTestId("auth-login-submit").click();
}

/** Ждёт, что браузер оказался на нужной странице кабинета. */
export async function expectLandedOn(page: Page, route: string | RegExp): Promise<void> {
  const pattern = typeof route === "string" ? new RegExp(`${route.replace(/\//g, "\\/")}`) : route;
  await expect(page).toHaveURL(pattern, { timeout: 30_000 });
}

/** Текст всплывающей ошибки (toast) — им форма сообщает о проблеме. */
export function toast(page: Page) {
  return page.locator("[data-sonner-toast], [role='status'], [role='alert']");
}
