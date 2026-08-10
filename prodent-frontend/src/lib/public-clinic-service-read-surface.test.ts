import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicServiceReaders = [
  "src/lib/clinic-services.ts",
  "src/components/clinic/profile/ClinicServices.tsx",
  "src/components/booking/BookingForm.tsx",
  "src/components/crm/QuickAppointmentDialog.tsx",
  "src/components/crm/appointments/GuestAppointmentModal.tsx",
] as const;

const genericServiceRead = /\.from\(\s*["']services["']\s*\)/;

describe("public clinic service read surface", () => {
  it("keeps high-traffic catalogs on the canonical cache-backed API", () => {
    const violations = publicServiceReaders.filter((relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      return genericServiceRead.test(source);
    });

    expect(violations).toEqual([]);
  });
});
