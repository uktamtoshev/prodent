import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const externalBaseUrl = process.env.PRODUCT_BASE_URL;
const baseURL = externalBaseUrl || "http://127.0.0.1:4176";

export default defineConfig({
  testDir: "./tests/performance",
  testMatch: "sprint13-web-vitals.spec.ts",
  outputDir: "test-results/sprint13-performance",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 800 },
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4176",
        url: "http://127.0.0.1:4176/",
        reuseExistingServer: !isCI,
        timeout: 60_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
