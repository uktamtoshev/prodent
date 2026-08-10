/**
 * Single catalog of the staff cabinet's sections.
 *
 * The problem this solves
 * ----------------------
 * The same page components are mounted under TWO url namespaces:
 * `/crm/calendar` and `/doctor/calendar` both render `DoctorMyDay`,
 * `/crm/treatment-plans/:id` and `/doctor/treatment-plans/:id` both render
 * `DoctorPlanEdit`, and so on (see `routes/crm-routes.tsx` and
 * `routes/doctor-routes.tsx`). The sidebar links only to `/crm/*`, while 23
 * in-page `navigate()` calls go to `/doctor/*`.
 *
 * Two things broke as a result:
 *  1. Active state. The sidebar decided "am I here?" with
 *     `pathname.startsWith(item.path)`, so the moment a doctor opened a patient
 *     from "My day" and landed on `/doctor/patients/123`, EVERY menu item went
 *     dark — the product stopped answering "where am I" (Nielsen #1).
 *  2. Badges. `navBadges` keyed its notification buckets by `/crm/*` paths, so
 *     reading messages at `/doctor/messages` never cleared the red "3" next to
 *     Messages. Within a week every badge is permanent noise and the doctor
 *     stops reacting to real events.
 *
 * Why aliases and not a single namespace
 * --------------------------------------
 * Collapsing `/doctor/*` into redirects is the right end state, but the two
 * route groups carry DIFFERENT role guards (`RoleRouteBoundary group="doctor"`
 * vs the CRM boundary, plus a `group="medical"` inner boundary on clinical
 * routes). Rewriting guards and navigation in one step risks locking staff out
 * of their own cabinet. So: one catalog, many aliases, one canonical path for
 * links. Consolidation can then happen section by section without touching the
 * navigation again.
 *
 * Adding a section: add it here, not in the sidebar and not in navBadges.
 */

export type CabinetSectionKey =
  | "home"
  | "myDay"
  | "invitations"
  | "schedule"
  | "patients"
  | "messages"
  | "tasks"
  | "medicalRecords"
  | "medicalAccess"
  | "treatmentPlans"
  | "media"
  | "services"
  | "laboratory"
  | "inventory"
  | "market"
  | "jobs"
  | "finance"
  | "balance"
  | "billing"
  | "reports"
  | "doctorRequests"
  | "notifications"
  | "settings"
  | "profile"
  | "queue";

export interface CabinetSection {
  /** The path the menu links to. One canonical destination per section. */
  path: string;
  /**
   * i18n key for the section name. Lives here so the sidebar item and the page
   * top bar cannot disagree about what the current section is called — the
   * cabinet previously showed two different titles on the same screen.
   */
  labelKey: string;
  /**
   * Every path that means "the user is inside this section", including the
   * canonical one. Child routes match automatically (`/crm/patients` also
   * covers `/crm/patients/123`), so list only distinct entry points.
   */
  matchPaths: readonly string[];
  /**
   * Notification types whose unread count rolls up onto this section's badge.
   * One type belongs to exactly one section — no double counting.
   */
  notificationTypes?: readonly string[];
  /**
   * Match the canonical path exactly. Only the dashboard needs this: `/crm`
   * is a prefix of every other CRM route.
   */
  exact?: boolean;
}

export const CABINET_SECTIONS: Record<CabinetSectionKey, CabinetSection> = {
  home: {
    path: "/crm",
    labelKey: "crm.home",
    matchPaths: ["/crm"],
    exact: true,
  },

  myDay: {
    path: "/crm/calendar",
    labelKey: "crm.myDay",
    matchPaths: ["/crm/calendar", "/doctor/calendar", "/doctor"],
  },
  invitations: {
    path: "/crm/invitations",
    labelKey: "crmInvitations.title",
    matchPaths: ["/crm/invitations"],
    // `clinic_invitation` is deliberately absent: the item has its own
    // dedicated pending-count query (useClinicInvitationsCount), so rolling it
    // up here too would badge it twice.
  },

  schedule: {
    path: "/crm/schedule",
    labelKey: "crm.schedule",
    matchPaths: ["/crm/schedule", "/crm/appointments"],
    notificationTypes: [
      "appointment_confirmed",
      "appointment_rescheduled",
      "appointment_cancelled",
      "appointment_reminder",
    ],
  },
  patients: {
    path: "/crm/patients",
    labelKey: "crm.patients",
    matchPaths: ["/crm/patients", "/doctor/patients"],
    // A new appointment means a new patient wants in; an approved medical
    // access means the patient now shows up in the doctor's list.
    notificationTypes: ["appointment_new", "medical_access_approved"],
  },
  messages: {
    path: "/crm/messages",
    labelKey: "crm.messages",
    matchPaths: ["/crm/messages", "/doctor/messages"],
    notificationTypes: ["message_new"],
  },
  tasks: {
    path: "/crm/tasks",
    labelKey: "crm.tasks",
    matchPaths: ["/crm/tasks"],
  },
  medicalRecords: {
    path: "/crm/medical-records",
    labelKey: "crm.medicalRecords",
    matchPaths: [
      "/crm/medical-records",
      "/crm/medical",
      "/doctor/medical-records",
    ],
  },
  medicalAccess: {
    path: "/crm/medical-access",
    labelKey: "crm.medicalAccess",
    matchPaths: ["/crm/medical-access"],
  },
  treatmentPlans: {
    path: "/crm/treatment-plans",
    labelKey: "crm.treatmentPlans",
    matchPaths: [
      "/crm/treatment-plans",
      "/crm/visit",
      "/doctor/treatment-plans",
      "/doctor/visit",
    ],
  },
  media: {
    path: "/doctor/media",
    labelKey: "crm.mediaLibrary",
    matchPaths: ["/doctor/media"],
  },

  services: {
    path: "/crm/services",
    labelKey: "crm.services",
    matchPaths: ["/crm/services"],
  },
  laboratory: {
    path: "/lab",
    labelKey: "crm.laboratory",
    matchPaths: ["/lab", "/crm/laboratory", "/doctor/laboratory"],
    notificationTypes: ["lab_order_ready", "LAB_ORDER"],
  },
  inventory: {
    path: "/sklad",
    labelKey: "crm.inventory",
    matchPaths: ["/sklad", "/crm/inventory", "/doctor/warehouse"],
    notificationTypes: ["low_stock"],
  },
  market: {
    path: "/market",
    labelKey: "crm.market",
    matchPaths: ["/market", "/doctor/market"],
  },
  jobs: { path: "/jobs", labelKey: "crm.jobs", matchPaths: ["/jobs"] },

  finance: {
    path: "/crm/finance",
    labelKey: "crm.finance",
    matchPaths: ["/crm/finance"],
    notificationTypes: ["invoice_ready", "payment_received"],
  },
  balance: {
    path: "/doctor/balance",
    labelKey: "crm.balance",
    matchPaths: ["/doctor/balance", "/crm/balance"],
  },
  billing: {
    path: "/crm/billing",
    labelKey: "crm.subscriptions",
    matchPaths: ["/crm/billing", "/doctor/billing"],
  },
  reports: {
    path: "/crm/reports",
    labelKey: "crm.reportsShort",
    matchPaths: ["/crm/reports"],
  },

  doctorRequests: {
    path: "/crm/doctor-requests",
    labelKey: "crm.doctorRequestsShort",
    matchPaths: ["/crm/doctor-requests"],
    notificationTypes: ["doctor_request"],
  },
  notifications: {
    path: "/crm/notifications",
    labelKey: "crm.notifications",
    matchPaths: ["/crm/notifications", "/doctor/notifications"],
  },
  settings: {
    path: "/crm/settings",
    labelKey: "crm.settings",
    matchPaths: ["/crm/settings"],
  },
  profile: {
    path: "/crm/profile",
    labelKey: "crm.profile",
    matchPaths: ["/crm/profile"],
  },
  queue: {
    path: "/crm/queue",
    labelKey: "crm.queue",
    matchPaths: ["/crm/queue"],
  },
};

/** True when `pathname` is the given path or one of its child routes. */
export function pathMatches(pathname: string, path: string, exact = false) {
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(path + "/");
}

/**
 * Length of the most specific `matchPaths` entry that covers `pathname`, or 0
 * when the section does not cover it at all.
 *
 * Specificity is what guarantees exactly ONE highlighted menu item: both
 * `/crm` (home) and `/crm/patients` cover `/crm/patients/123`, and the longer
 * match has to win.
 */
export function sectionMatchScore(
  section: CabinetSection,
  pathname: string,
): number {
  let best = 0;
  for (const candidate of section.matchPaths) {
    const isCanonical = candidate === section.path;
    if (!pathMatches(pathname, candidate, isCanonical && section.exact)) continue;
    if (candidate.length > best) best = candidate.length;
  }
  return best;
}

/** The section the given route belongs to, most specific match winning. */
export function sectionForPath(
  pathname: string,
): CabinetSectionKey | undefined {
  let bestKey: CabinetSectionKey | undefined;
  let bestScore = 0;
  for (const key of Object.keys(CABINET_SECTIONS) as CabinetSectionKey[]) {
    const score = sectionMatchScore(CABINET_SECTIONS[key], pathname);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}
