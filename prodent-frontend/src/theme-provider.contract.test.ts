import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("theme provider contract", () => {
  it("allows the user to choose light or dark mode", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

    expect(app).toContain('defaultTheme="light"');
    expect(app).toContain("enableSystem");
    expect(app).not.toContain("forcedTheme=");
  });
});
