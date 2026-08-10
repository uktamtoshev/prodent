import { describe, expect, it } from "vitest";

import { localeImporters } from "./locale-loader";
import { getAppTranslationNamespaces } from "./route-namespaces";

describe("app translation route namespaces", () => {
  it("keeps marketing pages on the base dictionary", () => {
    expect(getAppTranslationNamespaces("/")).toEqual([]);
    expect(getAppTranslationNamespaces("/search")).toEqual([]);
  });

  it("loads the profile bundles on the public doctor profile", () => {
    // /doctor/:id is public but renders the full profile surface (portfolio,
    // timeline, reviews, about), the chat and the clinic invitation manager.
    // With only the base dictionary it showed raw keys such as
    // "doctorPortfolio.filterAll" — caught live in the browser.
    expect(getAppTranslationNamespaces("/doctor/123")).toEqual([
      "shared",
      "doctor-profile",
      "doctor-communication",
      "crm-core",
    ]);
    // Cabinet segments keep their own, narrower sets.
    expect(getAppTranslationNamespaces("/doctor/calendar")).not.toContain(
      "doctor-profile",
    );
  });

  it("loads the shared bundle on the public clinic profile", () => {
    // The clinic page embeds the shared chat with its attachment picker
    // (`crmMessageComposer.*`).
    expect(getAppTranslationNamespaces("/clinic/123")).toEqual(["shared"]);
  });

  it("loads the patient cabinet shell namespace on /profile", () => {
    expect(getAppTranslationNamespaces("/profile")).toEqual([
      "shared",
      "patient-core",
    ]);
  });

  it("loads the manager's own strings on manager routes", () => {
    // `managerRole.*` lives in the ops bundle, which the CRM sets never load.
    expect(getAppTranslationNamespaces("/manager/services")).toContain("ops");
  });

  it("loads only admin translations for admin routes", () => {
    expect(getAppTranslationNamespaces("/admin/users")).toEqual(["shared", "admin"]);
  });

  it("loads route-scoped doctor and crm translations for doctor cabinet routes", () => {
    expect(getAppTranslationNamespaces("/doctor/calendar")).toEqual([
      "shared",
      "doctor-core",
      "doctor-schedule",
      "crm-core",
      "patient",
      "crm-schedule",
      "crm-patients",
    ]);
    expect(getAppTranslationNamespaces("/doctor/treatment-plans/42")).toEqual([
      "shared",
      "doctor-core",
      "doctor-treatment",
      "doctor-patients",
      "crm-core",
      "patient",
      "crm-treatment",
      "crm-patients",
      "crm-schedule",
      "doctor-communication",
    ]);
  });

  it("loads the visit screen's own namespace on visit routes", () => {
    // `doctorVisit.*` lives in the doctor-schedule bundle. It was missing here,
    // so the doctor's clinical screen rendered raw keys ("doctorVisit.
    // visitNotFound") in all six languages — caught in a live browser pass.
    for (const route of ["/doctor/visit/42", "/crm/visit/42"]) {
      expect(getAppTranslationNamespaces(route), route).toContain(
        "doctor-schedule",
      );
    }
    // Scoped: neighbouring routes must not pay for a bundle they never read.
    expect(
      getAppTranslationNamespaces("/doctor/treatment-plans/42"),
    ).not.toContain("doctor-schedule");
  });

  it("returns only namespaces configured in the locale loader", () => {
    const representativeRoutes = [
      "/admin/users",
      "/crm",
      "/crm/settings",
      "/doctor/messages",
      "/doctor/notifications",
      "/doctor/calendar",
      "/doctor/treatment-plans/42",
      "/patient/medical",
      "/seller/orders",
      "/technician/archive",
    ];

    for (const route of representativeRoutes) {
      for (const namespace of getAppTranslationNamespaces(route)) {
        expect(localeImporters[namespace], `${route} -> ${namespace}`).toBeDefined();
      }
    }
  });

  it("loads crm-related translations for clinic workspaces", () => {
    expect(getAppTranslationNamespaces("/crm/medical-records/1")).toEqual([
      "shared",
      "crm-core",
      "doctor-core",
      "patient",
      "crm-treatment",
      "crm-patients",
      "crm-schedule",
      "doctor-treatment",
      "doctor-patients",
      "doctor-communication",
      // The patient card reuses the visit screen's strings.
      "doctor-schedule",
    ]);
    expect(getAppTranslationNamespaces("/clinic-admin/schedule")).toEqual([
      "shared",
      "crm-core",
      "doctor-core",
      "patient",
      "crm-schedule",
      "crm-patients",
      "doctor-schedule",
    ]);
  });

  it("loads only finance crm translations for finance routes", () => {
    expect(getAppTranslationNamespaces("/crm/finance")).toEqual([
      "shared",
      "crm-core",
      "doctor-core",
      "patient",
      "crm-finance",
      "doctor-finance",
    ]);
  });

  it("loads commerce and ops translations for standalone work modules", () => {
    expect(getAppTranslationNamespaces("/seller/orders")).toEqual(["shared", "commerce"]);
    expect(getAppTranslationNamespaces("/doctor/market")).toEqual([
      "shared",
      "doctor-core",
      "doctor-market",
      "commerce",
    ]);
    expect(getAppTranslationNamespaces("/technician/archive")).toEqual(["shared", "ops"]);
  });

  it("loads route-scoped patient translations for patient cabinet routes", () => {
    expect(getAppTranslationNamespaces("/book/doctor-1")).toEqual([
      "shared",
      "patient-core",
    ]);
    expect(getAppTranslationNamespaces("/patient/dashboard")).toEqual([
      "shared",
      "patient-core",
      "patient-dashboard",
    ]);
    expect(getAppTranslationNamespaces("/patient/appointments")).toEqual([
      "shared",
      "patient-core",
      "patient-appointments",
      // "Перенести" (`patientCabinet.reschedule`) lives in the dashboard bundle.
      "patient-dashboard",
    ]);
    expect(getAppTranslationNamespaces("/patient/billing")).toEqual([
      "shared",
      "patient-core",
      "patient-finance",
    ]);
    expect(getAppTranslationNamespaces("/patient/medical")).toEqual([
      "shared",
      "patient-core",
      "patient-medical",
      "patient-files",
      "crm-treatment",
    ]);
  });
});
