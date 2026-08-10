import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");
const forbiddenMutation = /\.from\(\s*["'](?:services|doctor_services|clinic_doctor_services)["']\s*\)[\s\S]{0,500}?\.(?:insert|update|upsert|delete)\s*\(/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(entry.name)) || entry.name.includes(".test.")) return [];
    return [path];
  });
}

describe("clinic service write surface", () => {
  it("keeps service and assignment mutations behind dedicated scoped APIs", () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return forbiddenMutation.test(source) ? [path] : [];
    });

    expect(violations).toEqual([]);
  });
});
