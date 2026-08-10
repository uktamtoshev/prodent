import { createElement, lazy } from "react";
import { Route } from "react-router-dom";
import { RoleRouteBoundary } from "./RoleRouteBoundary";

const ClinicAdminSchedule = lazy(
  () => import("../pages/clinic-admin/ClinicAdminSchedule"),
);
const ClinicAdminAppointments = lazy(
  () => import("../pages/clinic-admin/ClinicAdminAppointments"),
);
const ClinicAdminPatients = lazy(
  () => import("../pages/clinic-admin/ClinicAdminPatients"),
);
const ClinicAdminMessages = lazy(
  () => import("../pages/clinic-admin/ClinicAdminMessages"),
);
const ClinicAdminPayments = lazy(
  () => import("../pages/clinic-admin/ClinicAdminPayments"),
);
const ClinicAdminPromotions = lazy(
  () => import("../pages/clinic-admin/ClinicAdminPromotions"),
);
const ClinicAdminNotifications = lazy(
  () => import("../pages/clinic-admin/ClinicAdminNotifications"),
);
const ClinicAdminSettings = lazy(
  () => import("../pages/clinic-admin/ClinicAdminSettings"),
);

export const clinicAdminRouteContract = [
  {
    path: "/clinic-admin/schedule",
    page: "ClinicAdminSchedule",
    guard: "parent-and-page-owned",
  },
  {
    path: "/clinic-admin/appointments",
    page: "ClinicAdminAppointments",
    guard: "parent-and-page-owned",
  },
  {
    path: "/clinic-admin/patients",
    page: "ClinicAdminPatients",
    guard: "parent-and-page-owned",
  },
  {
    path: "/clinic-admin/messages",
    page: "ClinicAdminMessages",
    guard: "parent-and-page-owned",
  },
  {
    path: "/clinic-admin/payments",
    page: "ClinicAdminPayments",
    guard: "parent-and-page-owned",
  },
  {
    path: "/clinic-admin/promotions",
    page: "ClinicAdminPromotions",
    guard: "parent-and-page-owned",
  },
  {
    path: "/clinic-admin/notifications",
    page: "ClinicAdminNotifications",
    guard: "parent-and-page-owned",
  },
  {
    path: "/clinic-admin/settings",
    page: "ClinicAdminSettings",
    guard: "parent-and-page-owned",
  },
] as const;

const clinicAdminPages = {
  ClinicAdminSchedule,
  ClinicAdminAppointments,
  ClinicAdminPatients,
  ClinicAdminMessages,
  ClinicAdminPayments,
  ClinicAdminPromotions,
  ClinicAdminNotifications,
  ClinicAdminSettings,
};

export const clinicAdminRouteElements = (
  <Route element={<RoleRouteBoundary group="clinic-admin" />}>
    {clinicAdminRouteContract.map((route) => (
      <Route
        key={route.path}
        path={route.path}
        element={createElement(clinicAdminPages[route.page])}
      />
    ))}
  </Route>
);
