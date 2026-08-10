import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/Profile.tsx"),
  "utf8",
);

describe("patient profile Sprint 1 UI contract", () => {
  it("connects every editable field to a visible label", () => {
    for (const id of [
      "profile-full-name",
      "profile-birth-date",
      "profile-gender",
      "profile-email",
      "profile-phone",
      "profile-address",
    ]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("keeps profile actions and fields touch friendly", () => {
    expect(source.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(9);
    expect(source).toContain("focus-within:ring-2");
    expect(source).toContain("Изменить фото профиля");
    expect(source).not.toContain('className="hidden"');
  });

  it("uses semantic theme colors for profile status cards", () => {
    expect(source).toContain("success-green");
    expect(source).toContain("border-primary/20");
    expect(source).toContain("border-accent");
    expect(source).not.toMatch(
      /\b(?:bg|border|text)-(?:blue|green|emerald|violet|purple|amber)-[0-9]/,
    );
  });

  it("uses compact mobile page spacing", () => {
    expect(source).toContain(
      'className="space-y-6 p-4 sm:p-6 lg:p-8"',
    );
  });
});
