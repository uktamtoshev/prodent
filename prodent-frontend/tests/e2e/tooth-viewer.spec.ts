import { expect, test, type Page } from "@playwright/test";

const VIEWER_URL =
  "/tooth-anatomy/?model=mock&motion=off&pixelRatio=1";

const ANATOMY_PARTS = [
  "Enamel",
  "Dentin",
  "Pulp",
  "RootCanal",
  "Cementum",
  "PeriodontalLigament",
] as const;

type RuntimeProblems = {
  consoleErrors: string[];
  pageErrors: string[];
};

const runtimeProblemsByPage = new WeakMap<Page, RuntimeProblems>();

function monitorRuntimeProblems(page: Page): RuntimeProblems {
  const problems: RuntimeProblems = {
    consoleErrors: [],
    pageErrors: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      const source = message.location().url;
      problems.consoleErrors.push(source ? `${source}: ${message.text()}` : message.text());
    }
  });
  page.on("pageerror", (error) => {
    problems.pageErrors.push(error.message);
  });

  return problems;
}

test.beforeEach(async ({ page }) => {
  runtimeProblemsByPage.set(page, monitorRuntimeProblems(page));
});

test.afterEach(async ({ page }, testInfo) => {
  const problems = runtimeProblemsByPage.get(page);
  if (!problems) return;

  const expectsMissingModel = testInfo.title.includes("provided GLB is missing");
  const unexpectedConsoleErrors = problems.consoleErrors.filter(
    (problem) => !(expectsMissingModel && problem.includes("/models/tooth.glb")),
  );
  expect(unexpectedConsoleErrors).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});

async function waitForStableViewer(page: Page) {
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });

  const viewer = page.getByTestId("tooth-viewer");
  await expect(viewer).toHaveAttribute("data-viewer-state", "ready");
  await expect(page.getByTestId("viewer-canvas")).toBeVisible();

  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });

  return viewer;
}

test.describe("3D tooth anatomy viewer", () => {
  test("shows a clear error when the provided GLB is missing", async ({
    page,
  }) => {
    await page.goto("/tooth-anatomy/?motion=off&pixelRatio=1", {
      waitUntil: "domcontentloaded",
    });

    const viewer = page.getByTestId("tooth-viewer");
    await expect(viewer).toHaveAttribute("data-viewer-state", "error");
    await expect(page.getByTestId("model-error")).toContainText(
      /модель не найдена|tooth\.glb/i,
    );
  });

  test("loads the deterministic mock and exposes all anatomy layers", async ({
    page,
  }) => {
    const viewer = await waitForStableViewer(page);

    await expect(viewer).toContainText(
      /\u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446|placeholder|mock/i,
    );
    await expect(page.getByTestId("viewer-canvas")).toHaveAttribute(
      "aria-label",
      /\S+/,
    );

    for (const part of ANATOMY_PARTS) {
      const checkbox = page.getByTestId(`layer-${part}`);
      await expect(checkbox).toBeVisible();
      await expect(checkbox).toBeChecked();
    }
  });

  test("selects Enamel through the keyboard-accessible layer control", async ({
    page,
  }) => {
    await waitForStableViewer(page);

    const enamelControl = page
      .getByRole("button", {
        name: /\u044d\u043c\u0430\u043b\u044c|enamel/i,
      })
      .first();
    await expect(enamelControl).toBeVisible();
    await enamelControl.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("info-title")).toContainText(
      /\u044d\u043c\u0430\u043b\u044c|enamel/i,
    );
  });

  test("selects a part with Raycaster and clears it on empty space", async ({
    page,
  }) => {
    await waitForStableViewer(page);

    const canvas = page.getByTestId("viewer-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    let modelPosition: { x: number; y: number } | null = null;
    for (const yRatio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      for (const xRatio of [0.25, 0.375, 0.5, 0.625, 0.75]) {
        const candidate = {
          x: Math.round(box!.width * xRatio),
          y: Math.round(box!.height * yRatio),
        };
        await canvas.hover({ position: candidate });
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
        );
        const cursor = await canvas.evaluate((element) => getComputedStyle(element).cursor);
        if (cursor === "pointer") {
          modelPosition = candidate;
          break;
        }
      }
      if (modelPosition) break;
    }

    expect(modelPosition).not.toBeNull();
    await canvas.click({ position: modelPosition! });
    await expect(canvas).toHaveAttribute(
      "data-selected-part",
      new RegExp(`^(${ANATOMY_PARTS.join("|")})$`),
    );
    await expect(page.getByTestId("info-title")).toBeVisible();

    await canvas.click({ position: { x: 8, y: 8 } });
    await expect(canvas).toHaveAttribute("data-selected-part", "");
    await expect(page.getByTestId("info-empty")).toBeVisible();
  });

  test("hides Enamel and restores it with Show all", async ({ page }) => {
    await waitForStableViewer(page);

    const enamel = page.getByTestId("layer-Enamel");
    await enamel.uncheck();
    await expect(enamel).not.toBeChecked();

    await page.getByTestId("show-all").click();
    await expect(enamel).toBeChecked();
  });

  test("announces a camera reset", async ({ page }) => {
    await waitForStableViewer(page);

    await page.getByTestId("reset-camera").click();
    await expect(page.getByTestId("viewer-status")).toContainText(
      /\u043a\u0430\u043c\u0435\u0440\u0430.*\u0441\u0431\u0440\u043e\u0448|camera.*reset/i,
    );
  });

  test("updates the clipping plane from its slider", async ({ page }) => {
    await waitForStableViewer(page);

    const slider = page.getByTestId("clipping-slider");
    const initialValue = await slider.inputValue();
    const minimum = await slider.getAttribute("min");
    const maximum = await slider.getAttribute("max");
    const targetValue = initialValue === maximum ? minimum : maximum;

    expect(targetValue).not.toBeNull();
    expect(targetValue).not.toBe(initialValue);
    await slider.fill(targetValue!);
    await expect(slider).toHaveValue(targetValue!);
  });

  test("does not emit console or page errors", async ({ page }) => {
    const problems = monitorRuntimeProblems(page);
    await waitForStableViewer(page);

    await page.getByTestId("clipping-slider").press("ArrowRight");
    await page.getByTestId("reset-camera").click();

    expect(problems.consoleErrors).toEqual([]);
    expect(problems.pageErrors).toEqual([]);
  });

  test("matches the desktop visual baseline", async ({ page }) => {
    await waitForStableViewer(page);

    await expect(page).toHaveScreenshot("tooth-viewer-desktop.png", {
      animations: "disabled",
      fullPage: true,
    });
  });
});

test.describe("3D tooth anatomy viewer on mobile", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("fits the mobile viewport without horizontal overflow", async ({ page }) => {
    await waitForStableViewer(page);

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    await expect(page.getByTestId("viewer-canvas")).toBeVisible();
  });

  test("matches the mobile visual baseline", async ({ page }) => {
    await waitForStableViewer(page);

    await expect(page).toHaveScreenshot("tooth-viewer-mobile.png", {
      animations: "disabled",
      fullPage: true,
    });
  });
});
