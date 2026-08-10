import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const billingRoot = resolve(process.cwd(), "src/components/billing");
const wildcardLucideImport = /import\s+\*\s+as\s+\w+\s+from\s+["']lucide-react["']/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(entry.name)) || entry.name.includes(".test.")) return [];
    return [path];
  });
}

describe("billing Lucide import surface", () => {
  it("does not bundle the entire icon library", () => {
    const violations = sourceFiles(billingRoot).filter((path) =>
      wildcardLucideImport.test(readFileSync(path, "utf8")),
    );

    expect(violations).toEqual([]);
  });
});
