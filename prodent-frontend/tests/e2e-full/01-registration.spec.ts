import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";
import {
  API_URL,
  cleanupTestUsers,
  latestOtpCode,
  newTestPhone,
  resetRateLimits,
  rolesOf,
  sqlValue,
  userCountByPhone,
  userIdOf,
} from "./helpers/stand";
import {
  enterOtp,
  fillRegistrationForm,
  loginViaUi,
  openAuth,
  registerViaUi,
  submitRegistrationForm,
} from "./helpers/auth-ui";

/**
 * Волна 1 плана ops/e2e-all-roles-plan.md — регистрация и вход всех пользователей.
 *
 * Всё через настоящий экран и настоящий backend. Код подтверждения тест берёт
 * из базы стенда — там, где его оставил бы SMS-шлюз в режиме dry-run.
 */

const PASSWORD = "ProdentE2e2026!";
const LEGAL_VERSION = "2026-07-27";

/** Куда каждая роль обязана попасть после входа (src/lib/roleHome.ts). */
const ROLE_HOME: Array<{ email: string; role: string; home: RegExp }> = [
  { email: "qa-super-admin@prodent.local", role: "super_admin", home: /\/admin/ },
  { email: "qa-admin@prodent.local", role: "admin", home: /\/admin/ },
  { email: "qa-moderator@prodent.local", role: "moderator", home: /\/admin\/moderation/ },
  { email: "qa-clinic-admin@prodent.local", role: "clinic_admin", home: /\/crm/ },
  { email: "qa-clinic-manager@prodent.local", role: "clinic_manager", home: /\/manager\/dashboard/ },
  { email: "qa-accountant@prodent.local", role: "accountant", home: /\/accountant\/invoices/ },
  { email: "qa-assistant@prodent.local", role: "assistant", home: /\/assistant\/schedule/ },
  { email: "qa-doctor@prodent.local", role: "doctor", home: /\/crm/ },
  { email: "qa-seller@prodent.local", role: "seller", home: /\/seller/ },
  { email: "qa-technician@prodent.local", role: "technician", home: /\/technician/ },
  { email: "qa-patient@prodent.local", role: "patient", home: /\/patient/ },
];
const QA_PASSWORD = "ProdentQa2026!";

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await playwrightRequest.newContext({ baseURL: API_URL });
  cleanupTestUsers();
});

test.afterAll(async () => {
  cleanupTestUsers();
  resetRateLimits();
  await api?.dispose();
});

test.beforeEach(() => {
  // Антифрод держит 3 кода на номер за 10 минут и паузу 60 секунд между кодами.
  // Набор регистрирует людей пачкой с одного адреса, поэтому счётчики сбрасываем.
  // Сам лимит проверяет отдельный тест ниже — он сброс не делает.
  resetRateLimits();
});

test.describe("Регистрация пациента", () => {
  test("пациент проходит регистрацию и попадает в свой кабинет", async ({ page }) => {
    const phone = newTestPhone(1);

    await registerViaUi(page, {
      role: "patient",
      phone,
      password: PASSWORD,
      lastName: "Пациентов",
      firstName: "Пётр",
      middleName: "Петрович",
    });

    await expect(page).toHaveURL(/\/patient/, { timeout: 30_000 });

    // Роль ровно одна — PATIENT.
    expect(rolesOf(phone)).toEqual(["PATIENT"]);

    const userId = userIdOf(phone);
    expect(userId).not.toBeNull();

    // Отчество сохранилось (раньше терялось на verify-code).
    expect(sqlValue(`SELECT middle_name FROM users WHERE id = '${userId}'`)).toBe("Петрович");

    // Согласие с документами зафиксировано на сервере — это юридическое доказательство.
    expect(
      sqlValue(`SELECT terms_version FROM registration_legal_consents WHERE user_id = '${userId}'`),
    ).toBe(LEGAL_VERSION);
  });

  test("после регистрации пациент входит по паролю", async ({ page }) => {
    const phone = newTestPhone(2);

    await registerViaUi(page, { role: "patient", phone, password: PASSWORD });
    await expect(page).toHaveURL(/\/patient/, { timeout: 30_000 });

    // Полностью выходим: тест должен проверить именно вход, а не остаток сессии.
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await loginViaUi(page, phone, PASSWORD);
    await expect(page).toHaveURL(/\/patient/, { timeout: 30_000 });
  });
});

test.describe("Регистрация мед-персонала", () => {
  const staffCases = [
    { role: "doctor" as const, form: "application-form-doctor", label: "врач" },
    { role: "clinic" as const, form: "application-form-clinic", label: "клиника" },
    { role: "technician" as const, form: "application-form-technician", label: "техник" },
    { role: "supplier" as const, form: "application-form-supplier", label: "поставщик" },
  ];

  for (const [index, staff] of staffCases.entries()) {
    test(`${staff.label}: регистрация ведёт на заявку и НЕ выдаёт роль пациента`, async ({ page }) => {
      const phone = newTestPhone(10 + index);

      await registerViaUi(page, {
        role: staff.role,
        phone,
        password: PASSWORD,
        orgName: staff.role === "clinic" ? "Клиника Тест" : "Поставщик Тест",
        lastName: "Персоналов",
        firstName: "Пётр",
      });

      // Персонал попадает не в кабинет, а на форму заявки на проверку.
      await expect(page.getByTestId(staff.form)).toBeVisible({ timeout: 30_000 });

      // Ключевая проверка: никакой роли до одобрения админом, и точно не PATIENT.
      expect(rolesOf(phone)).toEqual([]);
      expect(userCountByPhone(phone)).toBe(1);
    });
  }

  test("название организации сохраняется как имя аккаунта клиники", async ({ page }) => {
    const phone = newTestPhone(20);

    await registerViaUi(page, {
      role: "clinic",
      phone,
      password: PASSWORD,
      orgName: "Стоматология Улыбка",
    });

    await expect(page.getByTestId("application-form-clinic")).toBeVisible({ timeout: 30_000 });
    const userId = userIdOf(phone);
    expect(sqlValue(`SELECT first_name FROM users WHERE id = '${userId}'`)).toBe("Стоматология Улыбка");
  });
});

test.describe("Регистрация: отказы", () => {
  test("без согласия с документами форма не отправляется", async ({ page }) => {
    const phone = newTestPhone(30);

    await openAuth(page, "register");
    await fillRegistrationForm(page, { role: "patient", phone, password: PASSWORD, skipConsent: true });
    await page.getByTestId("auth-register-submit").click();

    // Остались на форме: шага с кодом нет, пользователь не создан.
    await expect(page.getByTestId("auth-otp-0")).toHaveCount(0);
    expect(userCountByPhone(phone)).toBe(0);
  });

  test("короткий пароль отклоняется", async ({ page }) => {
    const phone = newTestPhone(31);

    await openAuth(page, "register");
    await fillRegistrationForm(page, { role: "patient", phone, password: "short1!" });
    await page.getByTestId("auth-register-submit").click();

    await expect(page.getByTestId("auth-otp-0")).toHaveCount(0);
    expect(userCountByPhone(phone)).toBe(0);
  });

  test("неверный код не создаёт аккаунт", async ({ page }) => {
    const phone = newTestPhone(32);

    await openAuth(page, "register");
    await fillRegistrationForm(page, { role: "patient", phone, password: PASSWORD });
    await submitRegistrationForm(page);

    const realCode = latestOtpCode(phone, "REGISTRATION");
    const wrongCode = realCode === "000000" ? "111111" : "000000";
    await enterOtp(page, wrongCode);

    // Всё ещё на шаге кода, аккаунта нет.
    await expect(page.getByTestId("auth-otp-0")).toBeVisible();
    expect(userCountByPhone(phone)).toBe(0);
  });

  test("тот же номер второй раз зарегистрировать нельзя", async ({ page }) => {
    const phone = newTestPhone(33);

    await registerViaUi(page, { role: "patient", phone, password: PASSWORD });
    await expect(page).toHaveURL(/\/patient/, { timeout: 30_000 });

    resetRateLimits();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await openAuth(page, "register");
    await fillRegistrationForm(page, { role: "patient", phone, password: PASSWORD });
    await page.getByTestId("auth-register-submit").click();

    // Второго пользователя с этим номером не появилось.
    await expect(page.getByTestId("auth-otp-0")).toHaveCount(0, { timeout: 20_000 });
    expect(userCountByPhone(phone)).toBe(1);
  });

  test("код одноразовый: повторное подтверждение отклоняется", async () => {
    const phone = newTestPhone(34);

    const sent = await api.post("/api/v1/auth/send-otp", {
      data: { phone, action: "register" },
    });
    expect(sent.ok(), `send-otp: HTTP ${sent.status()}`).toBeTruthy();

    const code = latestOtpCode(phone, "REGISTRATION");
    const payload = {
      phone,
      code,
      action: "register",
      role: "patient",
      first_name: "Одно",
      last_name: "Разов",
      legal_consent_accepted: true,
      terms_version: LEGAL_VERSION,
      privacy_version: LEGAL_VERSION,
      locale: "ru",
    };

    const first = await api.post("/api/v1/auth/verify-code", { data: payload });
    expect(first.ok(), `первое подтверждение: HTTP ${first.status()}`).toBeTruthy();

    const second = await api.post("/api/v1/auth/verify-code", { data: payload });
    expect(second.ok(), "второй раз тот же код проходить не должен").toBeFalsy();
    expect(userCountByPhone(phone)).toBe(1);
  });

  test("регистрация без согласия отклоняется и на сервере", async () => {
    const phone = newTestPhone(35);

    const sent = await api.post("/api/v1/auth/send-otp", {
      data: { phone, action: "register" },
    });
    expect(sent.ok()).toBeTruthy();

    const response = await api.post("/api/v1/auth/verify-code", {
      data: {
        phone,
        code: latestOtpCode(phone, "REGISTRATION"),
        action: "register",
        role: "patient",
        first_name: "Без",
        last_name: "Согласия",
        legal_consent_accepted: false,
        terms_version: LEGAL_VERSION,
        privacy_version: LEGAL_VERSION,
        locale: "ru",
      },
    });

    expect(response.ok(), "без согласия аккаунта быть не должно").toBeFalsy();
    expect(userCountByPhone(phone)).toBe(0);
  });

  test("между двумя кодами на один номер выдерживается пауза", async () => {
    const phone = newTestPhone(36);

    const first = await api.post("/api/v1/auth/send-otp", { data: { phone, action: "register" } });
    expect(first.ok(), `первый код: HTTP ${first.status()}`).toBeTruthy();

    const second = await api.post("/api/v1/auth/send-otp", { data: { phone, action: "register" } });
    expect(second.ok(), "второй код подряд должен быть отбит антифродом").toBeFalsy();
    expect(second.status()).toBe(429);

    resetRateLimits();
  });
});

test.describe("Восстановление пароля", () => {
  test("пациент меняет пароль по коду из SMS и входит с новым", async ({ page }) => {
    const phone = newTestPhone(40);
    const newPassword = "ProdentE2eNew2026!";

    await registerViaUi(page, { role: "patient", phone, password: PASSWORD });
    await expect(page).toHaveURL(/\/patient/, { timeout: 30_000 });

    resetRateLimits();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await openAuth(page, "login");
    await page.getByTestId("auth-forgot-password").click();
    await page.getByTestId("auth-forgot-phone").fill(phone);
    await page.getByTestId("auth-forgot-submit").click();

    await expect(page.getByTestId("auth-otp-0")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("auth-forgot-new-password").fill(newPassword);
    await page.getByTestId("auth-forgot-confirm-password").fill(newPassword);
    await enterOtp(page, latestOtpCode(phone, "PASSWORD_RESET"));

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await loginViaUi(page, phone, newPassword);
    await expect(page).toHaveURL(/\/patient/, { timeout: 30_000 });
  });
});

test.describe("Вход всех ролей", () => {
  for (const account of ROLE_HOME) {
    test(`${account.role}: вход через форму ведёт в свой кабинет`, async ({ page }) => {
      await loginViaUi(page, account.email, QA_PASSWORD);
      await expect(page).toHaveURL(account.home, { timeout: 30_000 });
    });
  }

  test("неверный пароль в кабинет не пускает", async ({ page }) => {
    await loginViaUi(page, "qa-patient@prodent.local", "НеверныйПароль2026!");
    await expect(page).toHaveURL(/\/auth/);
  });
});
