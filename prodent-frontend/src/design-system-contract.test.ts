import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("design system v1 contract", () => {
  it("documents the runtime sources and reference routes", () => {
    const guide = readProjectFile("docs/design-system-v1.md");

    expect(guide).toContain("src/index.css");
    expect(guide).toContain("src/components/system");
    expect(guide).toContain("Public reference: `/`");
    expect(guide).toContain("CRM reference: `/crm/patients`");
    expect(guide).toContain("WCAG 2.2 AA");
  });

  it("keeps semantic light and dark tokens in the runtime stylesheet", () => {
    const stylesheet = readProjectFile("src/index.css");

    for (const token of [
      "--background:",
      "--foreground:",
      "--card:",
      "--primary:",
      "--muted:",
      "--border:",
      "--ring:",
    ]) {
      expect(stylesheet).toContain(token);
    }
    expect(stylesheet).toMatch(/\.dark\s*\{/);
  });

  it("disables non-essential motion when the user requests it", () => {
    const stylesheet = readProjectFile("src/index.css");

    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("animation-duration: 0.01ms");
    expect(stylesheet).toContain("transition-duration: 0.01ms");
  });
});
