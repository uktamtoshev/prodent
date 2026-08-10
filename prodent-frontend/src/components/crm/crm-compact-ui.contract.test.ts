import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const component = (path: string) =>
  readFileSync(resolve(process.cwd(), "src/components/crm", path), "utf8");

const sources = {
  appointments: component("scheduling/AppointmentListItem.tsx"),
  patientTags: component("patients/PatientTagBadge.tsx"),
  draggableAppointments: component(
    "calendar/DraggableAppointmentCard.tsx",
  ),
  tasks: component("tasks/TaskCard.tsx"),
  // The status map these components import. Banning palette classes in the
  // components while they imported `text-blue-700` / `bg-amber-50` from here
  // proved nothing — the colours arrived anyway, just through a module.
  appointmentStatuses: component("calendar/appointmentConstants.ts"),
};

describe("Sprint 1 CRM compact UI contract", () => {
  it.each(Object.entries(sources))(
    "%s keeps compact text readable and uses theme colors",
    (_name, source) => {
      expect(source).not.toMatch(/text-\[(?:9|10|11)px\]/);
      expect(source).not.toMatch(
        /(?:bg|text|border|ring)-(?:slate|neutral|blue|indigo|violet|green|red|amber|orange|emerald|sky)-/,
      );
    },
  );

  it("keeps interactive tag controls keyboard friendly", () => {
    expect(sources.patientTags).toContain('type="button"');
    expect(sources.patientTags).toContain("aria-pressed={selected}");
    expect(sources.patientTags).toContain("min-h-11");
    expect(sources.patientTags).toContain("focus-visible:ring-2");
  });

  it("keeps appointment actions large and named", () => {
    expect(sources.appointments).toContain('aria-label={patientName}');
    expect(sources.appointments).not.toContain('role="button"');
    expect(sources.appointments).toContain(
      'aria-label={t("crmStatusDropdown.changeStatus")}',
    );
    expect(sources.appointments).toContain("h-11 w-11");
    expect(sources.draggableAppointments).toContain(
      'aria-label={APPOINTMENT_STATUSES.confirmed.label}',
    );
    expect(sources.draggableAppointments).toContain("min-h-11 min-w-11");
  });

  it("keeps task actions visible on keyboard focus and at least 44px high", () => {
    expect(sources.tasks).toContain("sm:group-focus-within:opacity-100");
    expect(sources.tasks).toContain("h-11 w-11");
    expect(sources.tasks).toContain("min-h-11");
  });
});
