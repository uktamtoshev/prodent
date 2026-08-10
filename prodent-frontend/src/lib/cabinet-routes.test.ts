import { describe, expect, it } from "vitest";

import {
  CABINET_SECTIONS,
  type CabinetSectionKey,
  sectionForPath,
  sectionMatchScore,
} from "./cabinet-routes";
import { computeNavBadges, sectionTypesForPath } from "./navBadges";
import { crmRouteContract } from "@/routes/crm-routes";
import { doctorRouteContract } from "@/routes/doctor-routes";
import type { Notification } from "@/hooks/useNotifications";

const KEYS = Object.keys(CABINET_SECTIONS) as CabinetSectionKey[];

/** `/crm/patients/:id` -> `/crm/patients/123` so it can be resolved. */
const concrete = (path: string) => path.replace(/:[A-Za-z]+/g, "123");

describe("cabinet route catalog", () => {
  it("resolves a section for both url namespaces of the same page", () => {
    // The staff cabinet mounts the same components under /crm/* and /doctor/*.
    // Both have to land on the same menu section, otherwise the sidebar goes
    // dark the moment a doctor navigates from inside a page.
    for (const [crmPath, doctorPath] of [
      ["/crm/patients", "/doctor/patients"],
      ["/crm/messages", "/doctor/messages"],
      ["/crm/calendar", "/doctor/calendar"],
      ["/crm/treatment-plans", "/doctor/treatment-plans"],
      ["/crm/medical-records", "/doctor/medical-records"],
      ["/crm/notifications", "/doctor/notifications"],
    ]) {
      expect(sectionForPath(doctorPath), doctorPath).toBe(
        sectionForPath(crmPath),
      );
    }
  });

  it("keeps child routes inside their parent section", () => {
    expect(sectionForPath("/crm/patients/123")).toBe("patients");
    expect(sectionForPath("/doctor/patients/123")).toBe("patients");
    expect(sectionForPath("/doctor/visit/123")).toBe("treatmentPlans");
    expect(sectionForPath("/crm/treatment-plans/123")).toBe("treatmentPlans");
    expect(sectionForPath("/doctor/calendar/legacy")).toBe("myDay");
  });

  it("does not let the dashboard swallow every CRM route", () => {
    // `/crm` is a prefix of every other CRM path, so it is exact-match only.
    expect(sectionForPath("/crm")).toBe("home");
    expect(sectionForPath("/crm/finance")).toBe("finance");
    expect(sectionForPath("/crm/settings")).toBe("settings");
  });

  it("resolves every route to exactly one most-specific section", () => {
    // The guarantee the sidebar relies on: for any path, one winner. Two
    // sections may both cover a path (home and patients both cover
    // /crm/patients/123) but their specificity must differ.
    const paths = [
      ...crmRouteContract.map((r) => r.path),
      ...doctorRouteContract.map((r) => r.path),
    ].map(concrete);

    for (const path of paths) {
      const scores = KEYS.map((k) => sectionMatchScore(CABINET_SECTIONS[k], path))
        .filter((s) => s > 0)
        .sort((a, b) => b - a);
      if (scores.length === 0) continue; // route intentionally outside the menu
      if (scores.length > 1) {
        expect(scores[0], `ambiguous winner for ${path}`).toBeGreaterThan(
          scores[1],
        );
      }
    }
  });

  it("covers every cabinet route the menu is supposed to reach", () => {
    // A new page added to the route contract but not to the catalog would show
    // up as "no menu item highlighted" — catch it here instead.
    const uncovered = [
      ...crmRouteContract.map((r) => r.path),
      ...doctorRouteContract.map((r) => r.path),
    ]
      .map(concrete)
      .filter((path) => !sectionForPath(path));

    expect(uncovered, "routes with no cabinet section").toEqual([]);
  });
});

describe("sidebar badges clear in both url namespaces", () => {
  const unread = (type: string): Notification =>
    ({ id: type, type, read: false }) as Notification;

  it("buckets unread notifications onto sections", () => {
    const counts = computeNavBadges([
      unread("message_new"),
      unread("message_new"),
      unread("low_stock"),
    ]);
    expect(counts.messages).toBe(2);
    expect(counts.inventory).toBe(1);
    expect(counts.finance).toBeUndefined();
  });

  it("ignores already-read notifications", () => {
    const read = { id: "x", type: "message_new", read: true } as Notification;
    expect(computeNavBadges([read]).messages).toBeUndefined();
  });

  it("clears the Messages badge from the /doctor namespace too", () => {
    // This is the bug: badges were keyed by `/crm/*`, so reading messages at
    // `/doctor/messages` left a permanent red count and every badge became
    // noise the doctor learned to ignore.
    expect(sectionTypesForPath("/doctor/messages")).toContain("message_new");
    expect(sectionTypesForPath("/crm/messages")).toContain("message_new");
    expect(sectionTypesForPath("/doctor/patients/123")).toContain(
      "appointment_new",
    );
  });

  it("gives no types for sections that carry no notifications", () => {
    expect(sectionTypesForPath("/crm/settings")).toBeUndefined();
    expect(sectionTypesForPath("/nowhere")).toBeUndefined();
  });

  it("assigns each notification type to exactly one section", () => {
    // Two sections claiming the same type would double-count the badge.
    const seen = new Map<string, CabinetSectionKey>();
    for (const key of KEYS) {
      for (const type of CABINET_SECTIONS[key].notificationTypes ?? []) {
        expect(
          seen.get(type),
          `${type} is claimed by both ${seen.get(type)} and ${key}`,
        ).toBeUndefined();
        seen.set(type, key);
      }
    }
  });
});
