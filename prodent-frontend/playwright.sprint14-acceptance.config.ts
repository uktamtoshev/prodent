import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const externalBaseUrl = process.env.PRODUCT_BASE_URL;
const baseURL = externalBaseUrl || "http://127.0.0.1:4178";

export default defineConfig({
  testDir: "./tests/sprint14-acceptance",
  outputDir: "test-results/sprint14-acceptance",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/sprint14-acceptance/results.json" }],
    ["html", { open: "never", outputFolder: "playwright-report/sprint14-acceptance" }],
  ],
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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
      name: "android-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "iphone-webkit",
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 4178",
        url: "http://127.0.0.1:4178/health",
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
