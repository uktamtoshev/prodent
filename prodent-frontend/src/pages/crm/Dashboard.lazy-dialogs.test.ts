import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("crm dashboard dialog bundle split", () => {
  it("keeps the quick appointment dialog out of the eager dashboard route", () => {
    const source = readSource("src/pages/crm/Dashboard.tsx");

    expect(source).toContain('import("@/components/crm/appointments/GuestAppointmentModal")');
    expect(source).not.toMatch(/import\s+\{\s*GuestAppointmentModal\s*\}\s+from/);
    expect(source).toContain("quickAppointmentOpen &&");
  });
});
