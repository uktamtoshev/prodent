import type { ReactElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RoleRouteBoundary } from "./RoleRouteBoundary";
import {
  clinicAdminRouteContract,
  clinicAdminRouteElements,
} from "./clinic-admin-routes";
import { crmRouteContract, crmRouteElements } from "./crm-routes";
import { doctorRouteContract, doctorRouteElements } from "./doctor-routes";

function expectProtectedRouteGroup(
  parentRoute: ReactElement<{
    element: ReactElement<{ group: string }>;
    children: ReactElement<{ path?: string }>[];
  }>,
  group: string,
  expectedPaths: readonly string[],
) {
  expect(parentRoute.props.element.type).toBe(RoleRouteBoundary);
  expect(parentRoute.props.element.props.group).toBe(group);
  expect(parentRoute.props.children.map((route) => route.props.path)).toEqual(
    expectedPaths,
  );
}

describe("staff route contracts", () => {
  it("keeps private staff pages out of App while preserving the public doctor profile", () => {
    const appSource = readFileSync(
      resolve(process.cwd(), "src/App.tsx"),
      "utf8",
    );

    expect(appSource).toContain("{crmRouteElements}");
    expect(appSource).toContain("{clinicAdminRouteElements}");
    expect(appSource).toContain("{doctorRouteElements}");
    expect(appSource).not.toContain('import("./pages/crm/');
    expect(appSource).not.toContain('import("./pages/clinic-admin/');
    expect(appSource).toContain(
      'import("./pages/doctor/DoctorPublicProfile")',
    );
    expect(appSource).toContain(
      '<Route path="/doctor/:id" element={<DoctorPublicProfile />} />',
    );
  });

  it("preserves CRM paths and order under one parent boundary", () => {
    const paths = [
      "/crm",
      "/crm/schedule",
      "/crm/appointments",
      "/crm/patients",
      "/crm/patients/legacy",
      "/crm/patients/:id",
      "/crm/medical-records",
      "/crm/medical-records/legacy",
      "/crm/medical/:patientId",
      "/crm/messages",
      "/crm/queue",
      "/crm/inventory",
      "/crm/finance",
      "/crm/laboratory",
      "/crm/reports",
      "/crm/profile",
      "/crm/notifications",
      "/crm/invitations",
      "/crm/settings",
      "/crm/services",
      "/crm/doctor-requests",
      "/crm/balance",
      "/crm/billing",
      "/crm/calendar",
      "/crm/calendar/legacy",
      "/crm/treatment-plans",
      "/crm/treatment-plans/:id",
      "/crm/visit/:id",
      "/crm/tasks",
      "/crm/medical-access",
    ] as const;

    expect(crmRouteContract.map(({ path }) => path)).toEqual(paths);
    expect(crmRouteContract).toContainEqual({
      path: "/crm/appointments",
      redirect: "/crm/schedule",
      guard: "parent-only",
    });
    expectProtectedRouteGroup(crmRouteElements, "crm", paths);
  });

  it("preserves clinic-admin paths and order under one parent boundary", () => {
    const paths = [
      "/clinic-admin/schedule",
      "/clinic-admin/appointments",
      "/clinic-admin/patients",
      "/clinic-admin/messages",
      "/clinic-admin/payments",
      "/clinic-admin/promotions",
      "/clinic-admin/notifications",
      "/clinic-admin/settings",
    ] as const;

    expect(clinicAdminRouteContract.map(({ path }) => path)).toEqual(paths);
    expectProtectedRouteGroup(
      clinicAdminRouteElements,
      "clinic-admin",
      paths,
    );
  });

  it("preserves private doctor paths and redirects under one parent boundary", () => {
    const paths = [
      "/doctor",
      "/doctor/calendar",
      "/doctor/calendar/legacy",
      "/doctor/patients",
      "/doctor/patients/:patientId",
      "/doctor/messages",
      "/doctor/notifications",
      "/doctor/medical-records",
      "/doctor/treatment-plans",
      "/doctor/treatment-plans/:id",
      "/doctor/visit/:id",
      "/doctor/media",
      "/doctor/laboratory",
      "/doctor/balance",
      "/doctor/billing",
      "/doctor/warehouse",
      "/doctor/market",
    ] as const;

    expect(doctorRouteContract.map(({ path }) => path)).toEqual(paths);
    expect(doctorRouteContract).toContainEqual({
      path: "/doctor",
      redirect: "/doctor/calendar",
      guard: "parent-only",
    });
    expect(doctorRouteContract).toContainEqual({
      path: "/doctor/market",
      redirect: "/market",
      guard: "parent-only",
    });
    expectProtectedRouteGroup(doctorRouteElements, "doctor", paths);
  });
});
