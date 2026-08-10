import { createElement, lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { LAB_ROUTES } from "@/lib/lab-routes";
import { SKLAD_ROUTES } from "@/lib/sklad-routes";
import { RoleRouteBoundary } from "./RoleRouteBoundary";

const DoctorCalendar = lazy(() => import("../pages/doctor/DoctorCalendar"));
const DoctorMyDay = lazy(() => import("../pages/doctor/DoctorMyDay"));
const DoctorPatients = lazy(() => import("../pages/doctor/DoctorPatients"));
const DoctorPatientProfile = lazy(
  () => import("../pages/doctor/DoctorPatientProfile"),
);
const DoctorMedicalRecords = lazy(
  () => import("../pages/doctor/DoctorMedicalRecords"),
);
const DoctorTreatmentPlans = lazy(
  () => import("../pages/doctor/DoctorTreatmentPlans"),
);
const DoctorPlanEdit = lazy(() => import("../pages/doctor/DoctorPlanEdit"));
const DoctorVisit = lazy(() => import("../pages/doctor/DoctorVisit"));
const DoctorMedia = lazy(() => import("../pages/doctor/DoctorMedia"));
const DoctorMessages = lazy(() => import("../pages/doctor/DoctorMessages"));
const DoctorBalance = lazy(() => import("../pages/doctor/DoctorBalance"));
const DoctorBilling = lazy(() => import("../pages/doctor/DoctorBilling"));
const DoctorNotifications = lazy(
  () => import("../pages/doctor/DoctorNotifications"),
);

export const doctorRouteContract = [
  {
    path: "/doctor",
    redirect: "/doctor/calendar",
    guard: "parent-only",
  },
  {
    path: "/doctor/calendar",
    page: "DoctorMyDay",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/calendar/legacy",
    page: "DoctorCalendar",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/patients",
    page: "DoctorPatients",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/patients/:patientId",
    page: "DoctorPatientProfile",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/messages",
    page: "DoctorMessages",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/notifications",
    page: "DoctorNotifications",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/medical-records",
    page: "DoctorMedicalRecords",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/treatment-plans",
    page: "DoctorTreatmentPlans",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/treatment-plans/:id",
    page: "DoctorPlanEdit",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/visit/:id",
    page: "DoctorVisit",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/media",
    page: "DoctorMedia",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/laboratory",
    redirect: LAB_ROUTES.orders(),
    guard: "parent-only",
  },
  {
    path: "/doctor/balance",
    page: "DoctorBalance",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/billing",
    page: "DoctorBilling",
    guard: "parent-and-page-owned",
  },
  {
    path: "/doctor/warehouse",
    redirect: SKLAD_ROUTES.items(),
    guard: "parent-only",
  },
  {
    path: "/doctor/market",
    redirect: "/market",
    guard: "parent-only",
  },
] as const;

const doctorPages = {
  DoctorCalendar,
  DoctorMyDay,
  DoctorPatients,
  DoctorPatientProfile,
  DoctorMedicalRecords,
  DoctorTreatmentPlans,
  DoctorPlanEdit,
  DoctorVisit,
  DoctorMedia,
  DoctorMessages,
  DoctorBalance,
  DoctorBilling,
  DoctorNotifications,
};

const MEDICAL_DOCTOR_ROUTES = new Set([
  "/doctor/medical-records",
  "/doctor/treatment-plans",
  "/doctor/treatment-plans/:id",
  "/doctor/visit/:id",
]);

export const doctorRouteElements = (
  <Route element={<RoleRouteBoundary group="doctor" />}>
    {doctorRouteContract.map((route) => {
      const element =
        "redirect" in route ? (
            <Navigate to={route.redirect} replace />
          ) : (
            createElement(doctorPages[route.page])
          );
      return (
        <Route
          key={route.path}
          path={route.path}
          element={
            MEDICAL_DOCTOR_ROUTES.has(route.path) ? (
              <RoleRouteBoundary group="medical">{element}</RoleRouteBoundary>
            ) : element
          }
        />
      );
    })}
  </Route>
);
