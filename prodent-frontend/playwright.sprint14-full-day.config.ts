import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/sprint14-full-day",
  outputDir: "test-results/sprint14-full-day",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/sprint14-full-day/results.json" }],
    ["html", { open: "never", outputFolder: "playwright-report/sprint14-full-day" }],
  ],
  use: {
    baseURL: process.env.PRODUCT_BASE_URL || "http://127.0.0.1:4179",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PRODUCT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 4179",
        env: {
          ...process.env,
          VITE_DEV_PROXY_TARGET: process.env.PRODENT_API_URL || "http://127.0.0.1:8115",
        },
        url: "http://127.0.0.1:4179/health",
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
