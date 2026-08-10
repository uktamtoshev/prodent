import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/patient/dental/FDI3DDentalChart.tsx"),
  "utf8",
);

describe("FDI 3D chart keyboard fallback", () => {
  it("keeps the keyboard tooth navigator mounted while 3D is active", () => {
    expect(source).toContain("<FdiNavigator");
    expect(source).toContain("onKeyDown={(event) => moveFocus(event, numbers, index)}");
    expect(source).not.toContain("showFdiNavigator");
  });
});
