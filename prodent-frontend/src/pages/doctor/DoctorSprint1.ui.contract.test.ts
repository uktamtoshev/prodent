import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

const files = [
  "src/pages/doctor/DoctorMedicalRecords.tsx",
  "src/pages/doctor/DoctorPlanEdit.tsx",
] as const;

const fixedNeutralOrErrorPalette =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red)-\d{2,3}(?:\/\d+)?\b/;

describe("Sprint 1 doctor records and plan UI contract", () => {
  it.each(files)("%s keeps visible text at 12px or larger", (file) => {
    const source = readSource(file);
    const undersized = [...source.matchAll(/text-\[([0-9.]+)px\]/g)]
      .map((match) => Number(match[1]))
      .filter((size) => size < 12);

    expect(undersized, file).toEqual([]);
  });

  it.each(files)("%s uses semantic neutral and error colors", (file) => {
    expect(readSource(file), file).not.toMatch(fixedNeutralOrErrorPalette);
  });

  it("keeps medical-record controls touchable and keyboard-visible", () => {
    const source = readSource(files[0]);

    expect(source).toContain("min-h-11");
    expect(source).toContain("h-11 w-11");
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain('aria-label={t("doctorCalendar.moreActions")}');
    expect(source).toContain('role="status"');
    expect(source).toContain('role="alert"');
  });

  it("keeps the treatment table inside narrow viewports", () => {
    const source = readSource(files[1]);

    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("min-w-[760px]");
    expect(source).toContain('role="region"');
    expect(source).toContain("tabIndex={0}");
  });

  it("keeps plan actions and editable fields at least 44px tall", () => {
    const source = readSource(files[1]);

    expect(source).toContain("min-h-11");
    expect(source).toContain("h-11 w-11");
    expect(source).not.toMatch(
      /\b(?:h|min-h)-(?:5|6|7|8|9|10)\b[^"\n]*<(?:button|input)/,
    );
    expect(source).toContain('aria-label={t("doctorPlanEdit.downloadPdf")}');
    expect(source).toContain('aria-label={t("doctorPlanEdit.print")}');
  });
});
