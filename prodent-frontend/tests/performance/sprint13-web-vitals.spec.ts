import { expect, test, type Page, type Route } from "@playwright/test";

const PATIENT_ID = "00000000-0000-4000-8000-000000001313";

type VitalSnapshot = {
  lcp: number;
  lcpElement: string;
  cls: number;
  inp: number;
  supportsEventTiming: boolean;
  shifts: Array<{
    value: number;
    sources: Array<{
      node: string;
      previous: { x: number; y: number; width: number; height: number };
      current: { x: number; y: number; width: number; height: number };
    }>;
  }>;
};

declare global {
  interface Window {
    __prodentVitals?: VitalSnapshot;
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function prepareDeterministicBrowser(page: Page, authenticated: boolean) {
  await page.route(
    /^https:\/\/(?:rsms\.me|fonts\.googleapis\.com|fonts\.gstatic\.com|www\.googletagmanager\.com|mc\.yandex\.ru)\//,
    (route) => route.abort(),
  );
  await page.addInitScript(({ patientId, hasSession }) => {
    localStorage.setItem("language", "ru");
    localStorage.setItem("theme", "light");

    if (hasSession) {
      const encode = (value: object) =>
        btoa(JSON.stringify(value))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", "");
      const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({
        sub: patientId,
        email: "sprint13.patient@prodent.test",
        roles: ["patient"],
      })}.test-signature`;
      localStorage.setItem("prodent_access_token", token);
      localStorage.setItem(
        "prodent_user_profile",
        JSON.stringify({
          id: patientId,
          email: "sprint13.patient@prodent.test",
          firstName: "Sprint",
          lastName: "Thirteen",
          roles: ["patient"],
        }),
      );
    } else {
      localStorage.removeItem("prodent_access_token");
      localStorage.removeItem("prodent_refresh_token");
      localStorage.removeItem("prodent_user_profile");
    }

    const snapshot: VitalSnapshot = {
      lcp: 0,
      lcpElement: "",
      cls: 0,
      inp: 0,
      supportsEventTiming: PerformanceObserver.supportedEntryTypes.includes("event"),
      shifts: [],
    };
    window.__prodentVitals = snapshot;

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const latest = list.getEntries().at(-1);
        if (latest) {
          snapshot.lcp = latest.startTime;
          const element = (latest as PerformanceEntry & { element?: Element | null }).element;
          snapshot.lcpElement = element
            ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${[
                ...element.classList,
              ].slice(0, 3).join(".")}`
            : "";
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      const stopLcp = () => lcpObserver.disconnect();
      addEventListener("pointerdown", stopLcp, { once: true, capture: true });
      addEventListener("keydown", stopLcp, { once: true, capture: true });
    } catch {
      // The explicit LCP > 0 assertion reports unsupported browsers.
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
            sources?: Array<{
              node?: Node | null;
              previousRect: DOMRectReadOnly;
              currentRect: DOMRectReadOnly;
            }>;
          };
          if (!shift.hadRecentInput) {
            snapshot.cls += shift.value;
            snapshot.shifts.push({
              value: shift.value,
              sources: (shift.sources ?? []).map(({ node, previousRect, currentRect }) => {
                const label =
                  node instanceof Element
                    ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}.${[
                        ...node.classList,
                      ].slice(0, 3).join(".")}`
                    : "unknown";
                const rect = (value: DOMRectReadOnly) => ({
                  x: value.x,
                  y: value.y,
                  width: value.width,
                  height: value.height,
                });
                return {
                  node: label,
                  previous: rect(previousRect),
                  current: rect(currentRect),
                };
              }),
            });
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // The fixed Chromium projects support Layout Instability entries.
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const event = entry as PerformanceEntry & {
            duration: number;
            interactionId?: number;
          };
          if (event.interactionId) snapshot.inp = Math.max(snapshot.inp, event.duration);
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    } catch {
      snapshot.supportsEventTiming = false;
    }
  }, { patientId: PATIENT_ID, hasSession: authenticated });

  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/v1/data/user_roles") {
      return json(route, authenticated ? [{ role: "patient" }] : []);
    }
    if (pathname === "/api/v1/auth/me" || pathname === "/api/v1/users/me") {
      return json(route, {
        id: PATIENT_ID,
        email: "sprint13.patient@prodent.test",
        firstName: "Sprint",
        lastName: "Thirteen",
        roles: ["patient"],
      });
    }
    return json(route, []);
  });
}

const routes = [
  { name: "public", path: "/", authenticated: false, lcpBudget: 2_000 },
  {
    name: "patient cabinet",
    path: "/patient/dashboard",
    authenticated: true,
    lcpBudget: 2_500,
  },
] as const;

for (const route of routes) {
  test(`${route.name} stays inside the Sprint 13 Web Vitals budget`, async ({
    page,
  }, testInfo) => {
    await prepareDeterministicBrowser(page, route.authenticated);
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => {
      const probe = document.createElement("button");
      probe.type = "button";
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;z-index:2147483647";
      probe.addEventListener("click", () => {
        document.body.dataset.inpProbe = "complete";
      });
      document.body.append(probe);
      probe.dataset.prodentInpProbe = "true";
    });
    await page.locator("[data-prodent-inp-probe]").click({ force: true });
    await page.waitForTimeout(250);

    const metrics = await page.evaluate(() => window.__prodentVitals);
    expect(metrics, "Performance observers must be installed before application code").toBeTruthy();
    await testInfo.attach("web-vitals.json", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
    testInfo.annotations.push({
      type: "web-vitals",
      description: JSON.stringify(metrics),
    });

    expect(metrics?.supportsEventTiming, "Chromium Event Timing API is required").toBe(true);
    expect(metrics?.lcp, "LCP must be measured").toBeGreaterThan(0);
    const metricReport = JSON.stringify(metrics);
    expect(metrics?.lcp, metricReport).toBeLessThanOrEqual(route.lcpBudget);
    expect(metrics?.cls, metricReport).toBeLessThanOrEqual(0.1);
    expect(metrics?.inp, metricReport).toBeLessThanOrEqual(200);
  });
}
