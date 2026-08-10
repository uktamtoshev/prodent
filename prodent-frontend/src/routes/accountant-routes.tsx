import { createElement, lazy } from "react";
import { Route } from "react-router-dom";
import { RoleRouteBoundary } from "./RoleRouteBoundary";

const AccountantInvoices = lazy(
  () => import("../pages/accountant/AccountantInvoices"),
);
const AccountantPayments = lazy(
  () => import("../pages/accountant/AccountantPayments"),
);
const AccountantReports = lazy(
  () => import("../pages/accountant/AccountantReports"),
);
const AccountantSalaries = lazy(
  () => import("../pages/accountant/AccountantSalaries"),
);

export const accountantRouteContract = [
  {
    path: "/accountant/invoices",
    page: "AccountantInvoices",
    guard: "page-owned",
  },
  {
    path: "/accountant/payments",
    page: "AccountantPayments",
    guard: "page-owned",
  },
  {
    path: "/accountant/reports",
    page: "AccountantReports",
    guard: "page-owned",
  },
  {
    path: "/accountant/salaries",
    page: "AccountantSalaries",
    guard: "page-owned",
  },
] as const;

const accountantPages = {
  AccountantInvoices,
  AccountantPayments,
  AccountantReports,
  AccountantSalaries,
};

export const accountantRoutePaths = accountantRouteContract.map(
  ({ path }) => path,
);

export const accountantRouteElements = (
  <Route element={<RoleRouteBoundary group="accountant" />}>
    {accountantRouteContract.map((route) => (
      <Route
        key={route.path}
        path={route.path}
        element={createElement(accountantPages[route.page])}
      />
    ))}
  </Route>
);
