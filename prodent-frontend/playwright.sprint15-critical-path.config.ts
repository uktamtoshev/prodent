import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:5173";

export default defineConfig({
  globalSetup: "./tests/sprint15-critical-path/global-setup.ts",
  testDir: "./tests/sprint15-critical-path",
  // Keep traces/videos outside the Vite root. Otherwise every Playwright write
  // can trigger Tailwind/Vite HMR and reload the page under test.
  outputDir: "../ops/sprint-15/evidence/playwright-artifacts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  // The clean localhost backend starts cold and some public aggregate queries
  // need more than 15 seconds on the first request.
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "../ops/sprint-15/evidence/playwright-critical-path.json" }],
  ],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 60_000,
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
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
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 800 },
      },
    },
  ],
  webServer: {
    command: "npx vite --config vite.sprint15.config.ts",
    url: `${baseURL}/health`,
    env: {
      ...process.env,
      VITE_DEV_PROXY_TARGET: "http://127.0.0.1:8116",
    },
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
