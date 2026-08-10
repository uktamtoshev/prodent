import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("analytics html guards", () => {
  it("loads analytics only for real production ids", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(html).toContain("/^GTM-[A-Z0-9]+$/i.test(id)");
    expect(html).toContain("/^\\d+$/.test(id)");
    expect(html).not.toContain("id.indexOf('VITE_') === 0");
  });
});
