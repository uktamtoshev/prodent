import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.SEARCH_PERFORMANCE_BASE_URL;
const baseURL = externalBaseUrl || "http://127.0.0.1:4175";

export default defineConfig({
  testDir: "./tests/performance",
  outputDir: "test-results/search-performance",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/search-performance" }],
  ],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 60_000,
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "production-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4175",
        url: "http://127.0.0.1:4175/health",
        reuseExistingServer: false,
        timeout: 240_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
