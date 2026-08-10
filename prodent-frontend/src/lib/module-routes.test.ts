import { afterEach, describe, expect, it, vi } from "vitest";

const MODULE_HOSTS = [
  "work.prodent.uz",
  "sklad.prodent.uz",
  "lab.prodent.uz",
] as const;

async function loadRoutes(hostname: string) {
  vi.resetModules();
  vi.stubGlobal("window", { location: { hostname } });

  const [jobs, sklad, lab] = await Promise.all([
    import("./jobs-routes"),
    import("./sklad-routes"),
    import("./lab-routes"),
  ]);

  return { jobs, sklad, lab };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("module route isolation", () => {
  it.each(MODULE_HOSTS)("keeps every module off the shared root on %s", async (hostname) => {
    const { jobs, sklad, lab } = await loadRoutes(hostname);
    const moduleEntries = [
      jobs.JOBS_ROUTES.feed(),
      sklad.SKLAD_ROUTES.items(),
      lab.LAB_ROUTES.orders(),
    ];

    expect(moduleEntries).toEqual(["/jobs", "/sklad", "/lab"]);
    expect(moduleEntries).not.toContain("/");
    expect(new Set(moduleEntries).size).toBe(moduleEntries.length);
  });

  it("normalizes nested paths without changing module ownership", async () => {
    const { jobs, sklad, lab } = await loadRoutes("prodent.uz");

    expect(jobs.jobsPath("//resumes")).toBe("/jobs/resumes");
    expect(sklad.skladPath("//transactions")).toBe("/sklad/transactions");
    expect(lab.labPath("//finance")).toBe("/lab/finance");
  });
});
