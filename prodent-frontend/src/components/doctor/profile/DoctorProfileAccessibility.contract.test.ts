import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

const profilePage = readSource("src/pages/doctor/DoctorPublicProfile.tsx");
const profileHeader = readSource(
  "src/components/doctor/profile/DoctorProfileHeader.tsx",
);
const profileTabs = readSource(
  "src/components/doctor/profile/DoctorProfileTabs.tsx",
);
const editDialog = readSource(
  "src/components/doctor/profile/EditDoctorProfileDialog.tsx",
);
const settings = readSource(
  "src/components/doctor/profile/DoctorSettings.tsx",
);
const about = readSource("src/components/doctor/profile/DoctorAbout.tsx");

describe("doctor profile accessibility contract", () => {
  it("keeps the actual profile page controls touchable and theme-aware", () => {
    expect(profilePage).toContain("min-h-11");
    expect(profilePage).toContain("h-11 w-11");
    expect(profilePage).toContain("focus-visible:ring-2");
    expect(profilePage).not.toMatch(/\b(?:h|w)-9\b/);
    expect(profilePage).not.toMatch(/\bbg-gray-\d{2,3}\b/);
    expect(profilePage).not.toContain("text-white");
  });

  it.each([
    ["actual page", profilePage],
    ["reusable tabs", profileTabs],
  ])("%s exposes roving keyboard tabs", (_label, source) => {
    expect(source).toMatch(/role=["']tablist["']/);
    expect(source).toMatch(/role=["']tab["']/);
    expect(source).toContain("aria-selected=");
    expect(source).toContain("aria-controls=");
    expect(source).toContain("handleTabKeyDown");
    expect(source).toMatch(/event\.key === ["']ArrowRight["']/);
    expect(source).toMatch(/event\.key === ["']Home["']/);
  });

  it("links the actual selected tab to its panel", () => {
    expect(profilePage).toContain('role="tabpanel"');
    expect(profilePage).toContain(
      "id={`doctor-profile-panel-${activeTab}`}",
    );
    expect(profilePage).toContain(
      "aria-labelledby={`doctor-profile-tab-${activeTab}`}",
    );
  });

  it("keeps reusable header actions visible, touchable and narrow-screen safe", () => {
    expect(profileHeader).toContain("h-11 w-11");
    expect(profileHeader).toContain("flex-wrap");
    expect(profileHeader).toContain("min-w-0");
    expect(profileHeader).toContain("focus-visible:opacity-100");
    expect(profileHeader).not.toMatch(/\bbg-gray-\d{2,3}\b/);
  });

  it("links dialog fields and reports save errors accessibly", () => {
    expect(editDialog).toContain('htmlFor="edit-doctor-full-name"');
    expect(editDialog).toContain('id="edit-doctor-full-name"');
    expect(editDialog).toContain('id="edit-doctor-form-error"');
    expect(editDialog).toContain('role="alert"');
    expect(editDialog).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(editDialog).toContain("w-[calc(100%-1rem)]");
  });

  it("labels settings fields, switches and password errors", () => {
    expect(settings).toContain('htmlFor="doctor-settings-full-name"');
    expect(settings).toContain('id="doctor-settings-full-name"');
    expect(settings).toContain("aria-labelledby=");
    expect(settings).toContain("aria-describedby=");
    expect(settings).toContain('id="doctor-settings-password-error"');
    expect(settings).toContain('role="alert"');
    expect(settings).not.toMatch(
      /\b(?:bg|text)-(?:blue|orange|purple|indigo)-\d{2,3}\b/,
    );
  });

  it("keeps DoctorAbout edit and add actions touchable and named per section", () => {
    expect(about).toContain("h-11 w-11");
    expect(about).toContain("min-h-11");
    expect(about).toContain("aria-label={ariaLabel}");
    expect(about).toContain("editSectionLabel");
    expect(about).toContain("addSectionLabel");
    expect(about).toContain("focus-visible:ring-2");
  });
});
