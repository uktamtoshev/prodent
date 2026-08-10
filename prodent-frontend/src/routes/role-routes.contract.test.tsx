import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { RoleRouteBoundary } from "./RoleRouteBoundary";
import {
  accountantRouteContract,
  accountantRouteElements,
  accountantRoutePaths,
} from "./accountant-routes";
import {
  assistantRouteContract,
  assistantRouteElements,
  assistantRoutePaths,
} from "./assistant-routes";
import {
  managerRouteContract,
  managerRouteElements,
  managerRoutePaths,
} from "./manager-routes";

function pathsFromRouteElements(
  parentRoute: ReactElement<{ children: ReactElement<{ path?: string }>[] }>,
) {
  return parentRoute.props.children.map((route) => route.props.path);
}

function expectParentBoundary(
  parentRoute: ReactElement<{
    element: ReactElement<{ group: string }>;
  }>,
  group: string,
) {
  expect(parentRoute.props.element.type).toBe(RoleRouteBoundary);
  expect(parentRoute.props.element.props.group).toBe(group);
}

describe("simple role route contracts", () => {
  it("keeps assistant paths and order unchanged", () => {
    expect(assistantRouteContract).toEqual([
      { path: "/assistant/schedule", page: "AssistantSchedule", guard: "page-owned" },
      { path: "/assistant/rooms", page: "AssistantRooms", guard: "page-owned" },
      { path: "/assistant/materials", page: "AssistantMaterials", guard: "page-owned" },
      { path: "/assistant/appointments", page: "AssistantAppointments", guard: "page-owned" },
    ]);
    expect(pathsFromRouteElements(assistantRouteElements)).toEqual(
      assistantRoutePaths,
    );
    expectParentBoundary(assistantRouteElements, "assistant");
  });

  it("keeps accountant paths and order unchanged", () => {
    expect(accountantRouteContract).toEqual([
      { path: "/accountant/invoices", page: "AccountantInvoices", guard: "page-owned" },
      { path: "/accountant/payments", page: "AccountantPayments", guard: "page-owned" },
      { path: "/accountant/reports", page: "AccountantReports", guard: "page-owned" },
      { path: "/accountant/salaries", page: "AccountantSalaries", guard: "page-owned" },
    ]);
    expect(pathsFromRouteElements(accountantRouteElements)).toEqual(
      accountantRoutePaths,
    );
    expectParentBoundary(accountantRouteElements, "accountant");
  });

  it("keeps manager paths and order unchanged", () => {
    expect(managerRouteContract).toEqual([
      { path: "/manager/dashboard", page: "ManagerDashboard", guard: "page-owned" },
      { path: "/manager/kpi", page: "ManagerKPI", guard: "page-owned" },
      { path: "/manager/analytics", page: "ManagerAnalytics", guard: "page-owned" },
      { path: "/manager/staff", page: "ManagerStaff", guard: "page-owned" },
      { path: "/manager/services", page: "ManagerServices", guard: "page-owned" },
    ]);
    expect(pathsFromRouteElements(managerRouteElements)).toEqual(
      managerRoutePaths,
    );
    expectParentBoundary(managerRouteElements, "manager");
  });
});
