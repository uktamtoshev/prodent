import { describe, expect, it } from "vitest";
import source from "./AccountantReports.tsx?raw";

describe("Sprint 7 accountant lab finance boundary", () => {
  it("uses only the redacted aggregate endpoint", () => {
    expect(source).toContain("lab.clinicRevenue()");
    expect(source).not.toContain("lab.listOrders(");
    expect(source).not.toContain("patient_name");
    expect(source).not.toContain("listOrderFiles");
    expect(source).not.toContain("listMessages");
  });
});
