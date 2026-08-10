import { expect, test } from "@playwright/test";

const TEST_USER_ID = "00000000-0000-4000-8000-000000000710";

test.describe("Jobs mobile layout", () => {
  test.skip(
    ({ isMobile }) => !isMobile,
    "This regression is specific to the mobile viewport.",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ userId }) => {
      const encode = (value: object) =>
        btoa(JSON.stringify(value))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", "");
      const accessToken = `${encode({ alg: "none", typ: "JWT" })}.${encode({
        sub: userId,
        email: "mobile.jobs@prodent.test",
        roles: ["doctor"],
      })}.test-signature`;

      localStorage.setItem("prodent_access_token", accessToken);
      localStorage.setItem(
        "prodent_user_profile",
        JSON.stringify({
          id: userId,
          email: "mobile.jobs@prodent.test",
          firstName: "Mobile",
          lastName: "Jobs",
          roles: ["doctor"],
        }),
      );
    }, { userId: TEST_USER_ID });

    await page.route("**/api/v1/data/user_roles**", async (route) => {
      await route.fulfill({ json: [{ role: "doctor" }] });
    });
    await page.route("**/api/v1/data/doctors**", async (route) => {
      await route.fulfill({ json: [] });
    });
    await page.route("**/api/v1/jobs/listings**", async (route) => {
      await route.fulfill({
        json: [
          {
            id: "mobile-overflow-regression",
            listing_type: "vacancy",
            category: "dentist",
            title:
              "Стоматолог-ортодонт с очень длинным названием вакансии для мобильного экрана",
            clinic_name:
              "Международный стоматологический центр с очень длинным названием",
            city: "Ташкент",
            employment_type: "full_time",
            salary_min: 99_999_999,
            salary_max: 999_999_999,
            currency: "UZS",
            salary_mode: "range",
          },
        ],
      });
    });
  });

  test("job cards do not create horizontal page scrolling", async ({ page }) => {
    await page.goto("/jobs", { waitUntil: "domcontentloaded" });

    const card = page.getByRole("link", {
      name: /стоматолог-ортодонт/i,
    });
    await expect(card).toBeVisible();

    await expect
      .poll(() =>
        card.evaluate((element) => {
          const viewportWidth = document.documentElement.clientWidth;
          const cardBounds = element.getBoundingClientRect();
          return (
            document.documentElement.scrollWidth <= viewportWidth &&
            cardBounds.left >= 0 &&
            cardBounds.right <= viewportWidth
          );
        }),
      )
      .toBe(true);
  });
});
