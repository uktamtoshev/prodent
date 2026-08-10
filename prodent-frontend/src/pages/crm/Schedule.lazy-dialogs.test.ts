import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("schedule dialog bundle split", () => {
  it("keeps the create appointment dialog out of the eager schedule route", () => {
    const source = readSource("src/pages/crm/Schedule.tsx");

    expect(source).toContain(
      'import("@/components/crm/appointments/GuestAppointmentModal")',
    );
    expect(source).not.toMatch(/import\s+\{\s*GuestAppointmentModal\s*\}\s+from/);
    expect(source).toContain("getClinicSchedule");
    expect(source).toContain("bulkAppointments");
  });

  it("keeps appointment edit dialogs out of the eager schedule views", () => {
    const viewFiles = [
      "src/components/crm/scheduling/DayScheduleView.tsx",
      "src/components/crm/scheduling/WeekScheduleView.tsx",
      "src/components/crm/scheduling/MonthScheduleView.tsx",
      "src/components/crm/scheduling/RoomScheduleView.tsx",
    ];

    for (const file of viewFiles) {
      const source = readSource(file);

      expect(source).toContain('import("../calendar/AppointmentModal")');
      expect(source).not.toMatch(/import\s+\{\s*AppointmentModal\s*\}\s+from/);
      expect(source).toContain("isModalOpen && selectedAppointment");
    }
  });
});
