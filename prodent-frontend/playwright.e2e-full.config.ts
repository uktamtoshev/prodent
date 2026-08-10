import { defineConfig, devices } from "@playwright/test";

/**
 * Сквозные (E2E) тесты на настоящем backend и настоящей базе.
 *
 * Стенд поднимает `ops/e2e/run-e2e.ps1` (проект docker compose "prodent-e2e",
 * API на 8118, SMS в dry-run). Запускать тесты напрямую можно только когда
 * стенд уже поднят — иначе login/OTP просто некуда отправить.
 */
const apiUrl = process.env.PRODENT_API_URL || "http://127.0.0.1:8118";
const webPort = Number(process.env.E2E_WEB_PORT || 4181);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests/e2e-full",
  outputDir: "test-results/e2e-full",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Живой backend + настоящие письма экрана: шаги медленнее моков.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/e2e-full/results.json" }],
    ["html", { open: "never", outputFolder: "playwright-report/e2e-full" }],
  ],
  use: {
    baseURL,
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${webPort} --strictPort`,
        env: { ...process.env, VITE_DEV_PROXY_TARGET: apiUrl },
        url: `${baseURL}/health`,
        reuseExistingServer: true,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
