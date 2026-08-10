import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const patientFiles = [
  "src/components/patient/PatientDashboard.tsx",
  "src/pages/patient/PatientPaymentsPage.tsx",
  "src/pages/patient/PatientAppointments.tsx",
] as const;

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("patient Sprint 1 UI contract", () => {
  it.each(patientFiles)("%s keeps text at 12px or larger", (file) => {
    const undersized = [...readSource(file).matchAll(/text-\[([0-9.]+)px\]/g)]
      .map((match) => Number(match[1]))
      .filter((size) => size < 12);

    expect(undersized, file).toEqual([]);
  });

  it.each(patientFiles)("%s uses semantic theme colors", (file) => {
    expect(readSource(file), file).not.toMatch(fixedPaletteClass);
  });

  it.each(patientFiles)("%s exposes loading and error states", (file) => {
    const source = readSource(file);

    expect(source, file).toContain('role="status"');
    expect(source, file).toContain('aria-live="polite"');
    expect(source, file).toContain('role="alert"');
    expect(source, file).toContain("text-muted-foreground");
  });

  it.each(patientFiles)("%s keeps native button targets at least 44px tall", (file) => {
    const source = readSource(file);
    const buttonCount = source.match(/<button\b/g)?.length ?? 0;
    const sizedButtons =
      source.match(
        /<button\b[\s\S]*?className=(?:"[^"]*\b(?:min-h-11|h-11)\b[^"]*"|{cn\(\s*"[^"]*\b(?:min-h-11|h-11)\b)/g,
      ) ?? [];

    expect(buttonCount, file).toBeGreaterThan(0);
    expect(sizedButtons, file).toHaveLength(buttonCount);
  });

  it("keeps patient lists and page actions responsive", () => {
    const dashboard = readSource(patientFiles[0]);
    const payments = readSource(patientFiles[1]);
    const appointments = readSource(patientFiles[2]);

    expect(dashboard).toContain("p-4 sm:p-6");
    expect(payments).toContain("overflow-x-auto");
    expect(payments).toContain("sm:flex-row");
    expect(appointments).toContain("overflow-x-auto");
    expect(appointments).toContain("grid-cols-1");
  });

  it("keeps status colors semantic and icon-only deletion named", () => {
    const payments = readSource(patientFiles[1]);
    const appointments = readSource(patientFiles[2]);

    for (const source of [payments, appointments]) {
      expect(source).toContain("--success-green");
      expect(source).toContain("--warning-amber");
      expect(source).toContain("--destructive");
    }
    expect(payments).toContain('aria-label={tt("common.delete")}');
  });
});
