import { createElement, lazy } from "react";
import { Route } from "react-router-dom";
import { RoleRouteBoundary } from "./RoleRouteBoundary";

const ManagerDashboard = lazy(
  () => import("../pages/manager/ManagerDashboard"),
);
const ManagerKPI = lazy(() => import("../pages/manager/ManagerKPI"));
const ManagerAnalytics = lazy(
  () => import("../pages/manager/ManagerAnalytics"),
);
const ManagerStaff = lazy(() => import("../pages/manager/ManagerStaff"));
const ManagerServices = lazy(() => import("../pages/manager/ManagerServices"));

export const managerRouteContract = [
  {
    path: "/manager/dashboard",
    page: "ManagerDashboard",
    guard: "page-owned",
  },
  { path: "/manager/kpi", page: "ManagerKPI", guard: "page-owned" },
  {
    path: "/manager/analytics",
    page: "ManagerAnalytics",
    guard: "page-owned",
  },
  { path: "/manager/staff", page: "ManagerStaff", guard: "page-owned" },
  {
    path: "/manager/services",
    page: "ManagerServices",
    guard: "page-owned",
  },
] as const;

const managerPages = {
  ManagerDashboard,
  ManagerKPI,
  ManagerAnalytics,
  ManagerStaff,
  ManagerServices,
};

export const managerRoutePaths = managerRouteContract.map(({ path }) => path);

export const managerRouteElements = (
  <Route element={<RoleRouteBoundary group="manager" />}>
    {managerRouteContract.map((route) => (
      <Route
        key={route.path}
        path={route.path}
        element={createElement(managerPages[route.page])}
      />
    ))}
  </Route>
);
