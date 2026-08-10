import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { localeImporters } from "@/i18n/locale-loader";
import { SUPPORTED_LANGUAGES } from "@/i18n/types";

const roleSidebarPaths = [
  "src/components/clinic-admin/ClinicAdminSidebar.tsx",
  "src/components/assistant/AssistantSidebar.tsx",
  "src/components/accountant/AccountantSidebar.tsx",
  "src/components/manager/ManagerSidebar.tsx",
] as const;

const requiredKeys = [
  "roleSidebar.toggleNavigation",
  "roleSidebar.switchToLightTheme",
  "roleSidebar.switchToDarkTheme",
  "roleSidebar.switchLanguage",
  "roleSidebar.logout",
  "roleNavigation.clinicAdmin.label",
  "roleNavigation.assistant.label",
  "roleNavigation.accountant.label",
  "roleNavigation.manager.label",
] as const;

function get(dictionary: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => {
    if (typeof value !== "object" || value === null || !(part in value)) return undefined;
    return (value as Record<string, unknown>)[part];
  }, dictionary);
}

describe("role navigation localization", () => {
  it("keeps the four role sidebars free from hard-coded Cyrillic labels", () => {
    for (const relativePath of roleSidebarPaths) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");

      expect(source, relativePath).toContain("useLanguage");
      expect(source, relativePath).toContain("roleNavigation.");
      expect(source, relativePath).not.toMatch(/[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/u);
    }
  });

  it("provides the navigation and control labels in every supported base locale", async () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const dictionary = (await localeImporters.base[language]()).default;

      for (const key of requiredKeys) {
        const value = get(dictionary, key);
        expect(value, `${language}:${key}`).toEqual(expect.any(String));
        expect(value, `${language}:${key}`).not.toBe(key);
      }
    }
  });
});
