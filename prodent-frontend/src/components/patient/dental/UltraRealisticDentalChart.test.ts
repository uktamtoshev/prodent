import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("UltraRealisticDentalChart", () => {
  it("keeps the heavy 3D chart behind a lazy import", () => {
    const adapterSource = readFileSync(
      resolve(process.cwd(), "src/components/patient/dental/UltraRealisticDentalChart.tsx"),
      "utf8",
    );
    const eagerChartImport =
      /^import\s+(?!type\b)[^;\n]*from\s+["']\.\/FDI3DDentalChart["'];?/m;

    expect(adapterSource).not.toMatch(eagerChartImport);
    expect(adapterSource).toContain('import("./FDI3DDentalChart")');
  });
});
