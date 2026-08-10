import { createElement, lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { LAB_ROUTES } from "@/lib/lab-routes";
import { SKLAD_ROUTES } from "@/lib/sklad-routes";
import { RoleRouteBoundary } from "./RoleRouteBoundary";

const CRMDashboard = lazy(() => import("../pages/crm/Dashboard"));
const Schedule = lazy(() => import("../pages/crm/Schedule"));
const Patients = lazy(() => import("../pages/crm/Patients"));
const PatientDetail = lazy(() => import("../pages/crm/PatientDetail"));
const MedicalRecords = lazy(() => import("../pages/crm/MedicalRecords"));
const Queue = lazy(() => import("../pages/crm/Queue"));
const Finance = lazy(() => import("../pages/crm/Finance"));
const CRMProfile = lazy(() => import("../pages/crm/CRMProfile"));
const CRMNotifications = lazy(() => import("../pages/crm/Notifications"));
const CRMInvitations = lazy(() => import("../pages/crm/Invitations"));
const CRMSettings = lazy(() => import("../pages/crm/CRMSettings"));
const CRMReports = lazy(() => import("../pages/crm/Reports"));
const DoctorRequests = lazy(() => import("../pages/crm/DoctorRequests"));
const CRMMessages = lazy(() => import("../pages/crm/Messages"));
const CRMServices = lazy(() => import("../pages/crm/Services"));
const CRMTasks = lazy(() => import("../pages/crm/Tasks"));
const DoctorMedicalAccess = lazy(
  () => import("../pages/crm/DoctorMedicalAccess"),
);
const ClinicBalance = lazy(() => import("../pages/crm/ClinicBalance"));
const CRMBilling = lazy(() => import("../pages/crm/Billing"));
const DoctorCalendar = lazy(() => import("../pages/doctor/DoctorCalendar"));
const DoctorMyDay = lazy(() => import("../pages/doctor/DoctorMyDay"));
const DoctorPatients = lazy(() => import("../pages/doctor/DoctorPatients"));
const DoctorMedicalRecords = lazy(
  () => import("../pages/doctor/DoctorMedicalRecords"),
);
const DoctorTreatmentPlans = lazy(
  () => import("../pages/doctor/DoctorTreatmentPlans"),
);
const DoctorPlanEdit = lazy(() => import("../pages/doctor/DoctorPlanEdit"));
const DoctorVisit = lazy(() => import("../pages/doctor/DoctorVisit"));

export const crmRouteContract = [
  { path: "/crm", page: "CRMDashboard", guard: "parent-and-page-owned" },
  {
    path: "/crm/schedule",
    page: "Schedule",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/appointments",
    redirect: "/crm/schedule",
    guard: "parent-only",
  },
  {
    path: "/crm/patients",
    page: "Patients",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/patients/legacy",
    page: "Patients",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/patients/:id",
    page: "PatientDetail",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/medical-records",
    page: "DoctorMedicalRecords",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/medical-records/legacy",
    page: "MedicalRecords",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/medical/:patientId",
    page: "MedicalRecords",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/messages",
    page: "CRMMessages",
    guard: "parent-and-page-owned",
  },
  { path: "/crm/queue", page: "Queue", guard: "parent-and-page-owned" },
  {
    path: "/crm/inventory",
    redirect: SKLAD_ROUTES.items(),
    guard: "parent-only",
  },
  { path: "/crm/finance", page: "Finance", guard: "parent-and-page-owned" },
  {
    path: "/crm/laboratory",
    redirect: LAB_ROUTES.orders(),
    guard: "parent-only",
  },
  {
    path: "/crm/reports",
    page: "CRMReports",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/profile",
    page: "CRMProfile",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/notifications",
    page: "CRMNotifications",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/invitations",
    page: "CRMInvitations",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/settings",
    page: "CRMSettings",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/services",
    page: "CRMServices",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/doctor-requests",
    page: "DoctorRequests",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/balance",
    page: "ClinicBalance",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/billing",
    page: "CRMBilling",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/calendar",
    page: "DoctorMyDay",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/calendar/legacy",
    page: "DoctorCalendar",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/treatment-plans",
    page: "DoctorTreatmentPlans",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/treatment-plans/:id",
    page: "DoctorPlanEdit",
    guard: "parent-and-page-owned",
  },
  {
    path: "/crm/visit/:id",
    page: "DoctorVisit",
    guard: "parent-and-page-owned",
  },
  { path: "/crm/tasks", page: "CRMTasks", guard: "parent-and-page-owned" },
  {
    path: "/crm/medical-access",
    page: "DoctorMedicalAccess",
    guard: "parent-and-page-owned",
  },
] as const;

const crmPages = {
  CRMDashboard,
  Schedule,
  Patients,
  PatientDetail,
  MedicalRecords,
  Queue,
  Finance,
  CRMProfile,
  CRMNotifications,
  CRMInvitations,
  CRMSettings,
  CRMReports,
  DoctorRequests,
  CRMMessages,
  CRMServices,
  CRMTasks,
  DoctorMedicalAccess,
  ClinicBalance,
  CRMBilling,
  DoctorCalendar,
  DoctorMyDay,
  DoctorPatients,
  DoctorMedicalRecords,
  DoctorTreatmentPlans,
  DoctorPlanEdit,
  DoctorVisit,
};

const MEDICAL_CRM_ROUTES = new Set([
  "/crm/medical-records",
  "/crm/medical-records/legacy",
  "/crm/medical/:patientId",
  "/crm/treatment-plans",
  "/crm/treatment-plans/:id",
  "/crm/visit/:id",
  "/crm/medical-access",
]);

export const crmRouteElements = (
  <Route element={<RoleRouteBoundary group="crm" />}>
    {crmRouteContract.map((route) => {
      const element =
        "redirect" in route ? (
            <Navigate to={route.redirect} replace />
          ) : (
            createElement(crmPages[route.page])
          );
      return (
        <Route
          key={route.path}
          path={route.path}
          element={
            MEDICAL_CRM_ROUTES.has(route.path) ? (
              <RoleRouteBoundary group="medical">{element}</RoleRouteBoundary>
            ) : element
          }
        />
      );
    })}
  </Route>
);
