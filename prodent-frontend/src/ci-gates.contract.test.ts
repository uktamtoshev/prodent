import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe.each([
  [".github/workflows/ci.yml", "GitHub Actions"],
  [".gitlab-ci.yml", "GitLab CI"],
] as const)("Sprint 2 release gates in %s", (path) => {
  const workflow = read(path);

  it("blocks on lint, tests, typecheck and build", () => {
    expect(workflow).toContain("npm run lint");
    expect(workflow).toMatch(/npm run test:(coverage|run)/);
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm run build");
  });

  it("blocks on smoke, accessibility and visual regression", () => {
    expect(workflow).toContain("npm run test:e2e:smoke");
    expect(workflow).toContain("npm run test:e2e:accessibility");
    expect(workflow).toContain("npm run test:e2e:visual");
    expect(workflow).not.toContain("continue-on-error: true");
  });
});
