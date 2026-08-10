import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/sprint15",
  outputDir: "../ops/sprint-15/evidence/visit-billing-artifacts/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "../ops/sprint-15/evidence/visit-billing-artifacts/results.json" }],
    ["html", {
      open: "never",
      outputFolder: "../ops/sprint-15/evidence/visit-billing-artifacts/html",
    }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4180",
    ...devices["Desktop Chrome"],
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4180",
    env: {
      ...process.env,
      VITE_DEV_PROXY_TARGET: "http://127.0.0.1:8116",
    },
    url: "http://127.0.0.1:4180/health",
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
