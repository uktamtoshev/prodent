import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS = ["Card.tsx", "Button.tsx", "Badge.tsx", "SectionTitle.tsx", "Avatar.tsx"];

describe("legacy design layer compatibility", () => {
  it.each(COMPONENTS)("%s uses theme-aware tokens", (file) => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/design", file),
      "utf8",
    );

    expect(source).not.toMatch(/\bbg-white\b/);
    expect(source).not.toMatch(/\btext-slate-/);
    expect(source).not.toMatch(/\bborder-slate-/);
  });
});
