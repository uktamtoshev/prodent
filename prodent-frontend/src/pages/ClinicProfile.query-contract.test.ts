import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ClinicProfile doctor query contract", () => {
  it("uses the backend is_verified field for clinic doctors", () => {
    const source = readFileSync("src/pages/ClinicProfile.tsx", "utf8");
    const bookingSource = readFileSync("src/pages/PublicBooking.tsx", "utf8");

    expect(source).not.toContain(".eq('verified', true)");
    expect(source.match(/\.eq\('is_verified', true\)/g)).toHaveLength(3);
    expect(source.match(/\bis_verified,\s*$/gm)).toHaveLength(2);
    expect(source.match(/\bcategory,\s*$/gm)).toBeNull();
    expect(source).not.toContain(".eq('is_archived', false)");
    expect(bookingSource).not.toContain('.eq("is_archived", false)');
    expect(source).toContain(".eq('is_active', true)");
    expect(bookingSource).toContain('.eq("is_active", true)');
  });
});
