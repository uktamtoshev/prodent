import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  BOOKING_DOCTOR_ID,
  preparePublicBooking,
} from "./fixtures/public-booking";

async function chooseServiceDateAndTime(page: Page, time = "09:15") {
  await page.getByRole("button", { name: /Консультация/ }).click();
  const calendar = page.getByRole("grid");
  await calendar.locator("button:not([disabled])").first().click();
  await expect(page.getByRole("button", { name: time, exact: true })).toBeVisible();
  await page.getByRole("button", { name: time, exact: true }).click();
}

test("books only a backend slot, keeps promo/details and fits the viewport", async ({ page }) => {
  await preparePublicBooking(page);
  await page.goto(`/book/${BOOKING_DOCTOR_ID}?promo=promo-1`);

  await expect(page.getByText("Летняя скидка")).toBeVisible();
  await chooseServiceDateAndTime(page);
  await expect(page.getByText(/Услуга: Консультация/)).toBeVisible();
  await expect(page.getByText(/Время: 09:15/)).toBeVisible();
  await expect(page.getByRole("button", { name: "10:00", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /Подтвердить запись/ }).click();
  await expect(page.getByText("Запись подтверждена!")).toBeVisible();
  await expect(page.getByTestId("appointment-number")).toContainText(
    "appointment-acceptance",
  );

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((item) => item.impact === "critical")).toEqual([]);
});

test("books the same patient flow in Uzbek", async ({ page }) => {
  await preparePublicBooking(page);
  await page.addInitScript(() => localStorage.setItem("language", "uz"));
  await page.goto(`/book/${BOOKING_DOCTOR_ID}`);

  await page.getByRole("button", { name: "Konsultatsiya" }).click();
  await page.getByRole("grid").locator("button:not([disabled])").first().click();
  await page.getByRole("button", { name: "09:15", exact: true }).click();
  await page.getByRole("button", { name: "Yozuvni tasdiqlash" }).click();

  await expect(page.getByText("Yozuv tasdiqlandi!")).toBeVisible();
  await expect(page.getByTestId("appointment-number")).toContainText(
    "appointment-acceptance",
  );
});

test("availability error retries and empty backend slots stay empty", async ({ page }) => {
  const state = await preparePublicBooking(page, { failAvailabilityOnce: true });
  await page.goto(`/book/${BOOKING_DOCTOR_ID}`);
  await page.getByRole("button", { name: /Консультация/ }).click();
  await page.getByRole("grid").locator("button:not([disabled])").first().click();
  await expect(page.getByText(/Не удалось загрузить свободное время/)).toBeVisible();
  state.failAvailabilityOnce = false;
  await page.getByRole("button", { name: /Повторить/ }).click();
  await expect(page.getByRole("button", { name: "09:15", exact: true })).toBeVisible();
  expect(state.availabilityRequests).toBeGreaterThanOrEqual(2);
});

test("empty backend availability never invents local time slots", async ({ page }) => {
  await preparePublicBooking(page, { emptyAvailability: true });
  await page.goto(`/book/${BOOKING_DOCTOR_ID}`);
  await page.getByRole("button", { name: /Консультация/ }).click();
  await page.getByRole("grid").locator("button:not([disabled])").first().click();
  await expect(page.getByText(/свободного времени нет/)).toBeVisible();
  await expect(page.getByRole("button", { name: "09:00", exact: true })).toHaveCount(0);
});

test("doctor without assigned services can be booked without a service", async ({ page }) => {
  const state = await preparePublicBooking(page, { emptyServices: true });
  await page.goto(`/book/${BOOKING_DOCTOR_ID}`);

  await expect(page.getByTestId("booking-no-services")).toContainText(
    "Вы можете записаться без выбора услуги",
  );
  await expect(page.getByTestId("booking-service-option")).toHaveCount(0);
  await expect(page.getByTestId("booking-calendar")).toBeVisible();

  await page.getByRole("grid").locator("button:not([disabled])").first().click();
  await page.getByRole("button", { name: "09:15", exact: true }).click();
  await expect(page.getByText(/Услуга: Без выбора услуги/)).toBeVisible();
  await page.getByRole("button", { name: /Подтвердить запись/ }).click();

  await expect(page.getByText("Запись подтверждена!")).toBeVisible();
  expect(state.availabilityServiceIds).toEqual([null]);
  expect(state.appointmentServiceIds).toEqual([null]);
});

test("409 refreshes availability and network failure can be retried", async ({ page }) => {
  const state = await preparePublicBooking(page, { appointmentMode: "conflict-once" });
  await page.goto(`/book/${BOOKING_DOCTOR_ID}`);
  await chooseServiceDateAndTime(page);
  await page.getByRole("button", { name: /Подтвердить запись/ }).click();

  await expect(page.getByText(/Это время уже занято/)).toBeVisible();
  await expect(page.getByText("Консультация", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "11:30", exact: true })).toBeVisible();
  expect(state.availabilityRequests).toBeGreaterThan(1);

  state.appointmentMode = "network-once";
  state.appointmentRequests = 0;
  await page.getByRole("button", { name: "11:30", exact: true }).click();
  await page.getByRole("button", { name: /Подтвердить запись/ }).click();
  await expect(page.getByRole("button", { name: /Повторить/ })).toBeVisible();
  await page.getByRole("button", { name: /Повторить/ }).click();
  await expect(page.getByText("Запись подтверждена!")).toBeVisible();
  const retryIds = state.clientRequestIds.slice(-2);
  expect(retryIds[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(retryIds[1]).toBe(retryIds[0]);
});
