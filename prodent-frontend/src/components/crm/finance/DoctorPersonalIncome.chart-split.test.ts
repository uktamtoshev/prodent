import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("DoctorPersonalIncome chart bundle split", () => {
  const pageSource = readFileSync(
    resolve(process.cwd(), "src/components/crm/finance/DoctorPersonalIncome.tsx"),
    "utf8",
  );
  const chartSource = readFileSync(
    resolve(process.cwd(), "src/components/crm/finance/DoctorPersonalIncomeChart.tsx"),
    "utf8",
  );

  it("keeps Recharts out of the personal income shell", () => {
    expect(pageSource).not.toContain('from "recharts"');
    expect(pageSource).toContain('import("./DoctorPersonalIncomeChart")');
  });

  it("keeps the chart implementation in the lazy child component", () => {
    expect(chartSource).toContain('from "recharts"');
    expect(chartSource).toContain("ResponsiveContainer");
    expect(chartSource).toContain("AreaChart");
  });
});
