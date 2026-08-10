import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (file: string) =>
  readFileSync(resolve(process.cwd(), "src/components/patient", file), "utf8");

describe("patient shell UI foundation contract", () => {
  it("reserves the mobile toolbar before every patient shell child", () => {
    const source = readSource("PatientLayout.tsx");

    expect(source).toContain(
      'className="min-h-screen pt-16 lg:pl-64 lg:pt-0"',
    );
    expect(source).not.toContain(
      '<div className="pt-16 lg:pt-0">{children}</div>',
    );
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('t("common.loading")');
  });

  it("keeps the offline status visible below mobile navigation", () => {
    const source = readSource("PatientOfflineBanner.tsx");

    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("top-16");
    expect(source).toContain("lg:top-0");
    expect(source).toContain("patientCabinet.offlineStatus");
    expect(source).not.toContain("patientCabinet.offlineDraftSaved");
  });

  it("uses semantic warning colors and no sub-12px text in shell files", () => {
    const sources = [
      readSource("PatientLayout.tsx"),
      readSource("PatientSidebar.tsx"),
      readSource("PatientOfflineBanner.tsx"),
    ].join("\n");

    expect(sources).toContain("border-warning-amber/30");
    expect(sources).not.toMatch(
      /\b(?:text-\[(?:[0-9]|1[01](?:\.\d+)?)px\]|text-(?:\[?10px\]?|\[?11px\]?))\b/,
    );
    expect(sources).not.toMatch(
      /\b(?:bg|border|text)-(?:white|black|slate|gray|zinc|neutral|stone|amber|orange|red|rose)-/,
    );
  });

  it("provides neutral offline and draft-specific messages in every language", () => {
    for (const language of ["ru", "uz", "uz_cyrl", "kz", "kg", "tj"]) {
      const locale = readFileSync(
        resolve(
          process.cwd(),
          `src/i18n/locales/${language}.patient-core.ts`,
        ),
        "utf8",
      );

      expect(locale, language).toContain('"offlineStatus"');
      expect(locale, language).toContain('"offlineDraftSaved"');
    }
  });
});
