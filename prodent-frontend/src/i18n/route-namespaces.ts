import type { LocaleNamespace } from "./locale-loader";

function isRoute(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function uniqueNamespaces(namespaces: readonly LocaleNamespace[]): readonly LocaleNamespace[] {
  return Array.from(new Set(namespaces));
}

const DOCTOR_CABINET_PATH_PREFIXES = [
  "/doctor/balance",
  "/doctor/billing",
  "/doctor/calendar",
  "/doctor/laboratory",
  "/doctor/market",
  "/doctor/media",
  "/doctor/medical-records",
  "/doctor/messages",
  "/doctor/notifications",
  "/doctor/patients",
  "/doctor/treatment-plans",
  "/doctor/visit",
  "/doctor/warehouse",
] as const;

/**
 * The visit screen's strings (`doctorVisit.*`) live in the doctor-schedule
 * bundle, while the route otherwise needs the treatment/patients bundles. It
 * was not loaded, so /doctor/visit/:id and /crm/visit/:id rendered raw keys
 * like "doctorVisit.visitNotFound" in every language — found live in the
 * browser. Scoped to the visit routes so neighbouring screens do not pay for a
 * bundle they never read.
 *
 * The medical-records screen reuses the same `doctorVisit.*` / `doctorCalendar.*`
 * strings in its patient card, so it needs the bundle for the same reason.
 */
function isVisitRoute(pathname: string): boolean {
  return isRoute(pathname, "/doctor/visit") || isRoute(pathname, "/crm/visit");
}

function needsDoctorScheduleNamespace(pathname: string): boolean {
  return (
    isVisitRoute(pathname) ||
    isRoute(pathname, "/crm/medical-records") ||
    isRoute(pathname, "/doctor/medical-records")
  );
}

function withVisitNamespaces(
  pathname: string,
  namespaces: readonly LocaleNamespace[],
): readonly LocaleNamespace[] {
  return needsDoctorScheduleNamespace(pathname)
    ? uniqueNamespaces([...namespaces, "doctor-schedule"])
    : namespaces;
}

/**
 * /doctor/:id is the PUBLIC doctor profile, not a cabinet screen: React Router
 * ranks the static cabinet segments above this dynamic one, so everything that
 * is not a known cabinet segment is a doctor id. The page renders the whole
 * profile surface (portfolio, timeline, reviews, services, about) plus the
 * owner's editing dialogs, its chat (doctor-communication) and the clinic
 * invitation manager (crm-core) — none of which were loaded, so the page showed
 * raw keys such as "doctorPortfolio.filterAll".
 */
const DOCTOR_CABINET_SEGMENTS = new Set(
  DOCTOR_CABINET_PATH_PREFIXES.map((prefix) => prefix.slice("/doctor/".length)),
);

function isPublicDoctorProfileRoute(pathname: string): boolean {
  if (!isRoute(pathname, "/doctor") || pathname === "/doctor") return false;
  const segment = pathname.slice("/doctor/".length).split("/")[0];
  return segment.length > 0 && !DOCTOR_CABINET_SEGMENTS.has(segment);
}

const CRM_SHARED_NAMESPACES: LocaleNamespace[] = ["shared", "crm-core"];
const CRM_ROLE_NAMESPACES: LocaleNamespace[] = ["doctor-core", "patient"];
const DOCTOR_CORE_NAMESPACES: LocaleNamespace[] = ["shared", "doctor-core"];
const PATIENT_CORE_NAMESPACES: LocaleNamespace[] = ["shared", "patient-core"];

function getCrmTranslationNamespaces(pathname: string): readonly LocaleNamespace[] {
  if (
    isRoute(pathname, "/crm/schedule") ||
    isRoute(pathname, "/crm/appointments") ||
    isRoute(pathname, "/clinic-admin/schedule") ||
    isRoute(pathname, "/clinic-admin/appointments") ||
    isRoute(pathname, "/doctor/calendar") ||
    isRoute(pathname, "/assistant/schedule") ||
    isRoute(pathname, "/assistant/rooms") ||
    isRoute(pathname, "/assistant/appointments")
  ) {
    return [
      ...CRM_SHARED_NAMESPACES,
      ...CRM_ROLE_NAMESPACES,
      "crm-schedule",
      "crm-patients",
      "doctor-schedule",
    ];
  }

  if (
    isRoute(pathname, "/crm/patients") ||
    isRoute(pathname, "/clinic-admin/patients") ||
    isRoute(pathname, "/doctor/patients")
  ) {
    return [
      ...CRM_SHARED_NAMESPACES,
      ...CRM_ROLE_NAMESPACES,
      "crm-patients",
      "crm-schedule",
      "crm-treatment",
      "crm-finance",
      "doctor-patients",
    ];
  }

  if (
    isRoute(pathname, "/crm/medical-records") ||
    isRoute(pathname, "/crm/medical") ||
    isRoute(pathname, "/crm/medical-access") ||
    isRoute(pathname, "/crm/treatment") ||
    isRoute(pathname, "/crm/treatment-plans") ||
    isRoute(pathname, "/crm/visit") ||
    isRoute(pathname, "/doctor/treatment-plans") ||
    isRoute(pathname, "/doctor/medical-records") ||
    isRoute(pathname, "/doctor/media") ||
    isRoute(pathname, "/doctor/visit")
  ) {
    return withVisitNamespaces(pathname, [
      ...CRM_SHARED_NAMESPACES,
      ...CRM_ROLE_NAMESPACES,
      "crm-treatment",
      "crm-patients",
      "crm-schedule",
      "doctor-treatment",
      "doctor-patients",
      // The treatment-plan create flow reuses the messages patient search box
      // (`doctorMessages.searchPatient`).
      "doctor-communication",
    ]);
  }

  if (
    isRoute(pathname, "/crm/finance") ||
    isRoute(pathname, "/crm/billing") ||
    isRoute(pathname, "/crm/balance") ||
    isRoute(pathname, "/doctor/billing") ||
    isRoute(pathname, "/doctor/balance") ||
    isRoute(pathname, "/clinic-admin/payments") ||
    isRoute(pathname, "/accountant")
  ) {
    return [
      ...CRM_SHARED_NAMESPACES,
      ...CRM_ROLE_NAMESPACES,
      "crm-finance",
      "doctor-finance",
    ];
  }

  if (
    isRoute(pathname, "/crm/settings") ||
    isRoute(pathname, "/crm/services") ||
    isRoute(pathname, "/crm/profile") ||
    isRoute(pathname, "/crm/invitations") ||
    isRoute(pathname, "/manager") ||
    isRoute(pathname, "/clinic-admin/settings")
  ) {
    return [
      ...CRM_SHARED_NAMESPACES,
      ...CRM_ROLE_NAMESPACES,
      "crm-settings",
      "crm-schedule",
      // The settings screen embeds the currency manager (`crmCurrencyMgr.*`),
      // which lives in the finance bundle.
      "crm-finance",
      "doctor-profile",
      "doctor-communication",
    ];
  }

  if (
    isRoute(pathname, "/crm/lab") ||
    isRoute(pathname, "/crm/laboratory") ||
    isRoute(pathname, "/crm/inventory") ||
    isRoute(pathname, "/doctor/laboratory") ||
    isRoute(pathname, "/doctor/warehouse") ||
    isRoute(pathname, "/assistant/materials")
  ) {
    return [...CRM_SHARED_NAMESPACES, ...CRM_ROLE_NAMESPACES, "crm-ops", "doctor-ops"];
  }

  if (
    isRoute(pathname, "/crm/reports") ||
    isRoute(pathname, "/crm/dashboard") ||
    pathname === "/crm" ||
    isRoute(pathname, "/crm/tasks") ||
    isRoute(pathname, "/crm/queue") ||
    isRoute(pathname, "/crm/messages") ||
    isRoute(pathname, "/crm/notifications") ||
    isRoute(pathname, "/crm/doctor-requests")
  ) {
    return [
      ...CRM_SHARED_NAMESPACES,
      ...CRM_ROLE_NAMESPACES,
      "crm-schedule",
      "crm-patients",
      "crm-finance",
      "crm-settings",
      "doctor-schedule",
      "doctor-patients",
      "doctor-finance",
      "doctor-profile",
      "doctor-communication",
    ];
  }

  return [
    ...CRM_SHARED_NAMESPACES,
    "crm-schedule",
    "crm-patients",
    "crm-treatment",
    "crm-finance",
    "crm-settings",
    "crm-ops",
    ...CRM_ROLE_NAMESPACES,
    "doctor-schedule",
    "doctor-patients",
    "doctor-treatment",
    "doctor-finance",
    "doctor-ops",
    "doctor-profile",
    "doctor-communication",
  ];
}

function getDoctorTranslationNamespaces(pathname: string): readonly LocaleNamespace[] {
  if (isRoute(pathname, "/doctor/market")) {
    return [...DOCTOR_CORE_NAMESPACES, "doctor-market", "commerce"];
  }

  if (isRoute(pathname, "/doctor/calendar")) {
    return uniqueNamespaces([
      ...DOCTOR_CORE_NAMESPACES,
      "doctor-schedule",
      ...getCrmTranslationNamespaces(pathname),
    ]);
  }

  if (isRoute(pathname, "/doctor/patients")) {
    return uniqueNamespaces([
      ...DOCTOR_CORE_NAMESPACES,
      "doctor-patients",
      ...getCrmTranslationNamespaces(pathname),
    ]);
  }

  if (
    isRoute(pathname, "/doctor/treatment-plans") ||
    isRoute(pathname, "/doctor/medical-records") ||
    isRoute(pathname, "/doctor/visit")
  ) {
    return withVisitNamespaces(
      pathname,
      uniqueNamespaces([
        ...DOCTOR_CORE_NAMESPACES,
        "doctor-treatment",
        "doctor-patients",
        ...getCrmTranslationNamespaces(pathname),
      ]),
    );
  }

  if (isRoute(pathname, "/doctor/billing") || isRoute(pathname, "/doctor/balance")) {
    return uniqueNamespaces([
      ...DOCTOR_CORE_NAMESPACES,
      "doctor-finance",
      ...getCrmTranslationNamespaces(pathname),
    ]);
  }

  if (isRoute(pathname, "/doctor/laboratory") || isRoute(pathname, "/doctor/warehouse")) {
    return uniqueNamespaces([
      ...DOCTOR_CORE_NAMESPACES,
      "doctor-ops",
      ...getCrmTranslationNamespaces(pathname),
    ]);
  }

  if (isRoute(pathname, "/doctor/messages") || isRoute(pathname, "/doctor/notifications")) {
    return uniqueNamespaces([
      ...DOCTOR_CORE_NAMESPACES,
      // Both screens render the CRM cabinet shell (sidebar, clinic switcher,
      // command palette, `crm.*` / `crmSidebarMisc.*`), which lives in crm-core.
      ...CRM_SHARED_NAMESPACES,
      "doctor-communication",
      "crm-patients",
      "crm-schedule",
    ]);
  }

  if (isRoute(pathname, "/doctor/media")) {
    return uniqueNamespaces([
      ...DOCTOR_CORE_NAMESPACES,
      "doctor-profile",
      "doctor-treatment",
      ...getCrmTranslationNamespaces(pathname),
    ]);
  }

  return uniqueNamespaces([
    ...DOCTOR_CORE_NAMESPACES,
    "doctor-schedule",
    "doctor-patients",
    "doctor-treatment",
    "doctor-finance",
    "doctor-ops",
    "doctor-profile",
    "doctor-communication",
  ]);
}

function getPatientTranslationNamespaces(pathname: string): readonly LocaleNamespace[] {
  if (pathname === "/patient" || isRoute(pathname, "/patient/dashboard")) {
    return [...PATIENT_CORE_NAMESPACES, "patient-dashboard"];
  }

  if (isRoute(pathname, "/patient/appointments")) {
    // `patientCabinet.reschedule` lives in the dashboard bundle.
    return [...PATIENT_CORE_NAMESPACES, "patient-appointments", "patient-dashboard"];
  }

  if (isRoute(pathname, "/patient/book")) {
    return [...PATIENT_CORE_NAMESPACES, "patient-book", "patient-doctors"];
  }

  if (isRoute(pathname, "/patient/history")) {
    // The visit list shows the doctor label and the paid sum, whose strings sit
    // in the doctors and finance bundles.
    return [
      ...PATIENT_CORE_NAMESPACES,
      "patient-history",
      "patient-appointments",
      "patient-doctors",
      "patient-finance",
    ];
  }

  if (isRoute(pathname, "/patient/reminders") || isRoute(pathname, "/patient/notifications")) {
    return [...PATIENT_CORE_NAMESPACES, "patient-communication", "patient-appointments"];
  }

  if (isRoute(pathname, "/patient/my-doctors")) {
    // "Записаться" (`patientCabinet.bookAppointment`) lives in the dashboard bundle.
    return [...PATIENT_CORE_NAMESPACES, "patient-doctors", "patient-dashboard"];
  }

  if (isRoute(pathname, "/patient/billing")) {
    return [...PATIENT_CORE_NAMESPACES, "patient-finance"];
  }

  if (isRoute(pathname, "/patient/medical")) {
    return [
      ...PATIENT_CORE_NAMESPACES,
      "patient-medical",
      "patient-files",
      "crm-treatment",
    ];
  }

  if (isRoute(pathname, "/patient/access")) {
    return [...PATIENT_CORE_NAMESPACES, "patient-access"];
  }

  if (isRoute(pathname, "/patient/messages")) {
    return [...PATIENT_CORE_NAMESPACES, "patient-communication", "patient-doctors"];
  }

  if (isRoute(pathname, "/patient/files")) {
    return [...PATIENT_CORE_NAMESPACES, "patient-files"];
  }

  if (isRoute(pathname, "/patient/family")) {
    // The page title (`patientCabinet.family`) lives in the dashboard bundle.
    return [...PATIENT_CORE_NAMESPACES, "patient-family", "patient-dashboard"];
  }

  return uniqueNamespaces([
    ...PATIENT_CORE_NAMESPACES,
    "patient-dashboard",
    "patient-appointments",
    "patient-doctors",
    "patient-family",
    "patient-communication",
    "patient-finance",
    "patient-files",
    "patient-history",
    "patient-access",
    "patient-book",
    "patient-medical",
  ]);
}

export function getAppTranslationNamespaces(pathname: string): readonly LocaleNamespace[] {
  const shared: LocaleNamespace[] = ["shared"];

  if (isRoute(pathname, "/book")) {
    return uniqueNamespaces([...shared, "patient-core"]);
  }
  if (isRoute(pathname, "/admin")) return uniqueNamespaces([...shared, "admin"]);
  if (isRoute(pathname, "/patient")) {
    return uniqueNamespaces(getPatientTranslationNamespaces(pathname));
  }
  // /profile renders the patient cabinet shell (sidebar, layout, offline banner).
  if (isRoute(pathname, "/profile")) {
    return uniqueNamespaces([...shared, "patient-core"]);
  }
  // The public clinic profile embeds the shared chat with its attachment picker.
  if (isRoute(pathname, "/clinic")) {
    return uniqueNamespaces([...shared]);
  }
  if (DOCTOR_CABINET_PATH_PREFIXES.some((prefix) => isRoute(pathname, prefix))) {
    return getDoctorTranslationNamespaces(pathname);
  }
  if (isPublicDoctorProfileRoute(pathname)) {
    return uniqueNamespaces([
      ...shared,
      "doctor-profile",
      "doctor-communication",
      "crm-core",
    ]);
  }
  if (isRoute(pathname, "/manager")) {
    // Manager screens render the CRM shell plus their own `managerRole.*`
    // strings, which live in the ops bundle.
    return uniqueNamespaces([...getCrmTranslationNamespaces(pathname), "ops"]);
  }
  if (
    isRoute(pathname, "/crm") ||
    isRoute(pathname, "/clinic-admin") ||
    isRoute(pathname, "/accountant") ||
    isRoute(pathname, "/assistant")
  ) {
    return uniqueNamespaces(getCrmTranslationNamespaces(pathname));
  }
  if (
    isRoute(pathname, "/seller") ||
    isRoute(pathname, "/market")
  ) {
    return uniqueNamespaces([...shared, "commerce"]);
  }
  if (isRoute(pathname, "/jobs")) {
    return uniqueNamespaces([...shared, "ops"]);
  }
  if (
    isRoute(pathname, "/technician") ||
    isRoute(pathname, "/sklad") ||
    isRoute(pathname, "/lab")
  ) {
    return uniqueNamespaces([...shared, "ops"]);
  }

  return [];
}
