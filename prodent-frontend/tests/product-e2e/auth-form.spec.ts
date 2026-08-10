import { expect, test } from "@playwright/test";

async function expectMinTarget(
  locator: import("@playwright/test").Locator,
  minSize = 44,
) {
  const box = await locator.boundingBox();
  expect(box, "interactive target must be visible").not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(minSize);
  expect(box!.width).toBeGreaterThanOrEqual(minSize);
}

async function openAuthPage(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("prodent_access_token");
    window.localStorage.removeItem("prodent_refresh_token");
    window.localStorage.removeItem("prodent_pending_role");
    window.localStorage.setItem("language", "ru");
    window.sessionStorage.clear();
  });
  await page.goto("/auth", { waitUntil: "domcontentloaded" });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.getByTestId("auth-login-identifier").isVisible().catch(() => false)) {
      return;
    }

    const retryButton = page.getByRole("button", { name: /Повторить|Qayta urinish/i });
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click();
    } else {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }

  await expect(page.getByTestId("auth-login-identifier")).toBeVisible({ timeout: 30_000 });
}

test.describe("auth form smoke", () => {
  test("login form validates empty credentials without leaving auth page", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openAuthPage(page);
    await expect(page.getByTestId("auth-login-identifier")).toBeVisible();
    await expect(page.getByTestId("auth-login-password")).toBeVisible();

    await page.getByTestId("auth-login-submit").click();

    const identifier = page.getByTestId("auth-login-identifier");
    const password = page.getByTestId("auth-login-password");
    await expect(identifier).toHaveClass(/border-destructive/);
    await expect(identifier).toHaveAttribute("aria-invalid", "true");
    await expect(identifier).toHaveAttribute("aria-describedby", "login-identifier-error");
    await expect(page.locator("#login-identifier-error")).toBeVisible();
    await expect(password).toHaveClass(/border-destructive/);
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAttribute("aria-describedby", "login-password-error");
    await expect(page.locator("#login-password-error")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/auth");
    expect(pageErrors).toEqual([]);
  });

  test("registration form validates required patient fields before OTP request", async ({ page }) => {
    const otpRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/send-otp")) {
        otpRequests.push(request.url());
      }
    });

    await openAuthPage(page);
    await page.getByTestId("auth-register-tab").click();
    await expect(page.getByTestId("auth-register-phone")).toBeVisible();

    await page.getByTestId("auth-register-submit").click();

    const phone = page.getByTestId("auth-register-phone");
    const password = page.getByTestId("auth-register-password");
    const confirmPassword = page.getByTestId("auth-register-confirm-password");
    await expect(phone).toHaveClass(/border-destructive/);
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await expect(phone).toHaveAttribute("aria-describedby", "register-phone-error");
    await expect(page.locator("#register-phone-error")).toBeVisible();
    await expect(password).toHaveClass(/border-destructive/);
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAttribute("aria-describedby", "register-password-error");
    await expect(page.locator("#register-password-error")).toBeVisible();
    await expect(confirmPassword).toBeVisible();

    await password.fill("strong-pass-123");
    await page.getByTestId("auth-register-submit").click();
    await expect(confirmPassword).toHaveAttribute("aria-invalid", "true");
    await expect(confirmPassword).toHaveAttribute(
      "aria-describedby",
      "register-confirm-password-error",
    );
    await expect(page.locator("#register-confirm-password-error")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/auth");
    expect(otpRequests).toEqual([]);
  });

  test("tabs, password actions and remember control work from the keyboard", async ({ page }) => {
    await openAuthPage(page);

    const loginTab = page.getByTestId("auth-login-tab");
    const registerTab = page.getByTestId("auth-register-tab");
    await expect(loginTab).toHaveAttribute("role", "tab");
    await expect(loginTab).toHaveAttribute("aria-selected", "true");
    await expectMinTarget(loginTab);
    await expectMinTarget(registerTab);

    await loginTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(registerTab).toHaveAttribute("aria-selected", "true");

    await registerTab.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(loginTab).toHaveAttribute("aria-selected", "true");

    const rememberTarget = page.getByTestId("auth-remember-target");
    const rememberCheckbox = page.getByRole("checkbox", { name: "Запомнить меня" });
    await expectMinTarget(rememberTarget);
    const rememberedBefore = await rememberCheckbox.getAttribute("aria-checked");
    await rememberCheckbox.focus();
    await page.keyboard.press("Space");
    await expect(rememberCheckbox).not.toHaveAttribute("aria-checked", rememberedBefore || "false");

    const password = page.getByTestId("auth-login-password");
    const reveal = page.getByTestId("auth-login-password-reveal");
    await expectMinTarget(reveal);
    await expect(reveal).toHaveAttribute("aria-controls", "login-password");
    await expect(reveal).toHaveAttribute("aria-pressed", "false");
    await reveal.focus();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await expect(reveal).toHaveAttribute("aria-pressed", "true");

    const forgot = page.getByTestId("auth-forgot-password");
    await expectMinTarget(forgot);
    await forgot.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Восстановление пароля" })).toBeVisible();
  });

  test("registration role and name fields expose accessible state and target sizes", async ({ page }) => {
    await openAuthPage(page);
    await page.getByTestId("auth-register-tab").click();

    const patient = page.getByTestId("auth-category-patient");
    const staff = page.getByTestId("auth-category-staff");
    await expect(patient).toHaveAttribute("aria-pressed", "true");
    await expectMinTarget(patient);
    await expectMinTarget(staff);

    await staff.focus();
    await page.keyboard.press("Space");
    await expect(staff).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("auth-role-doctor")).toHaveAttribute("aria-pressed", "true");

    const technician = page.getByTestId("auth-role-technician");
    await technician.focus();
    await page.keyboard.press("Enter");
    await expect(technician).toHaveAttribute("aria-pressed", "true");

    const lastName = page.getByLabel("Фамилия *");
    const firstName = page.getByLabel("Имя *");
    await expect(lastName).toHaveAttribute("id", "register-last-name");
    await expect(firstName).toHaveAttribute("id", "register-first-name");
    await expectMinTarget(lastName);
    await expectMinTarget(firstName);

    const reveal = page.getByTestId("auth-register-password-reveal");
    await expectMinTarget(reveal);
    await expect(reveal).toHaveAttribute("aria-controls", "register-password");
  });

  test("staff application waits for a successful set-password retry", async ({ page }) => {
    const tokenPayload = Buffer.from(
      JSON.stringify({
        sub: "doctor-auth-e2e",
        roles: ["PATIENT"],
        user_metadata: {
          role: "doctor",
          first_name: "Иван",
          last_name: "Иванов",
        },
      }),
    ).toString("base64url");
    const accessToken = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${tokenPayload}.signature`;
    let setPasswordAttempts = 0;
    let verifyRequestPayload: Record<string, unknown> | null = null;
    const setPasswordAuthorizationHeaders: Array<string | undefined> = [];

    await page.route("**/api/v1/auth/send-otp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, masked_phone: "+998 ** *** ** 67" }),
      });
    });
    await page.route("**/api/v1/auth/verify-code", async (route) => {
      verifyRequestPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          access_token: accessToken,
          refresh_token: "auth-e2e-refresh",
        }),
      });
    });
    await page.route("**/api/v1/auth/set-password", async (route) => {
      setPasswordAttempts += 1;
      setPasswordAuthorizationHeaders.push(route.request().headers().authorization);
      await route.fulfill({
        status: setPasswordAttempts === 1 ? 400 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          setPasswordAttempts === 1
            ? { message: "Пароль временно не сохранён" }
            : { success: true },
        ),
      });
    });
    await page.route("**/api/v1/data/doctor_applications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    // Authenticated layout hooks start as soon as the verified session is
    // restored. Keep those background reads deterministic so they cannot
    // occupy every browser connection while the application form chunk loads.
    await page.route("**/api/v1/data/user_roles**", async (route) => {
      await route.fulfill({ json: [{ role: "doctor" }] });
    });
    await page.route("**/api/v1/data/profiles**", async (route) => {
      await route.fulfill({ json: [] });
    });
    await page.route("**/api/v1/data/doctors**", async (route) => {
      await route.fulfill({ json: [] });
    });

    await openAuthPage(page);
    await page.getByTestId("auth-register-tab").click();
    await page.getByTestId("auth-category-staff").click();
    await page.getByTestId("auth-register-last-name").fill("Иванов");
    await page.getByTestId("auth-register-first-name").fill("Иван");
    await page.getByTestId("auth-register-phone").fill("+998 90 123 45 67");
    await page.getByTestId("auth-register-password").fill("strong-pass-123");
    await page.getByTestId("auth-register-confirm-password").fill("strong-pass-123");
    await page.getByTestId("auth-register-legal-consent").click();
    await page.getByTestId("auth-register-submit").click();

    const otpInputs = page.locator('input[inputmode="numeric"]');
    await expect(otpInputs).toHaveCount(6);
    for (const [index, digit] of [..."123456"].entries()) {
      await otpInputs.nth(index).fill(digit);
    }
    await page.getByRole("button", { name: "Подтвердить" }).click();
    expect(verifyRequestPayload).toMatchObject({
      action: "register",
      legal_consent_accepted: true,
      terms_version: "2026-07-27",
      privacy_version: "2026-07-27",
      phone: "+998901234567",
      role: "doctor",
    });

    const retryPassword = page.getByTestId("auth-set-password");
    await expect(retryPassword).toBeVisible();
    await expect(retryPassword).toHaveAttribute("aria-invalid", "true");
    await expect(retryPassword).toHaveAttribute("aria-describedby", "set-password-error");
    await expect(page.locator("#set-password-error")).toHaveText(
      "Пароль временно не сохранён",
    );
    await expect(page.getByText("Заявка на регистрацию врача")).toHaveCount(0);

    // Reproduce the real race: another auth request can clear shared storage
    // after the first failure. The page must restore the verified session from
    // memory before retrying.
    await page.evaluate(() => {
      window.localStorage.removeItem("prodent_access_token");
      window.localStorage.removeItem("prodent_refresh_token");
    });
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("prodent_access_token")))
      .toBeNull();

    await page.getByTestId("auth-set-password-submit").click();
    await expect(page.getByText("Заявка на регистрацию врача")).toBeVisible();
    expect(setPasswordAttempts).toBe(2);
    expect(setPasswordAuthorizationHeaders).toEqual([
      `Bearer ${accessToken}`,
      `Bearer ${accessToken}`,
    ]);
  });
});
