import { describe, expect, it } from "vitest";

import { localeImporters } from "./locale-loader";
import { getAppTranslationNamespaces } from "./route-namespaces";
import {
  SUPPORTED_LANGUAGES,
  type TranslationDictionary,
} from "./types";

const jobsKeys = [
  "jobs.feed.title",
  "jobs.feed.loading",
  "jobs.feed.openOffers",
  "jobs.feed.type",
  "jobs.feed.all",
  "jobs.feed.vacancies",
  "jobs.feed.chairRental",
  "jobs.feed.specialty",
  "jobs.feed.employment",
  "jobs.feed.searchPlaceholder",
  "jobs.feed.sortLabel",
  "jobs.feed.sortNew",
  "jobs.feed.sortCheap",
  "jobs.feed.sortExpensive",
  "jobs.feed.loadError",
  "jobs.feed.retry",
  "jobs.feed.nothingFound",
  "jobs.feed.changeFilters",
  ...[
    "dentistTherapist",
    "dentistSurgeon",
    "dentistOrthopedist",
    "dentistOrthodontist",
    "dentistPeriodontist",
    "dentistPediatric",
    "dentistImplantologist",
    "dentalAssistant",
    "nurse",
    "orderly",
    "receptionAdmin",
    "dentalTechnician",
    "chairRental",
    "other",
  ].map((key) => `jobs.category.${key}`),
  ...["fullTime", "partTime", "shift", "gig"].map(
    (key) => `jobs.employment.${key}`,
  ),
  ...["staffDoctor", "chairRental"].map(
    (key) => `jobs.cooperation.${key}`,
  ),
  ...["percent", "fixed", "agreement", "intern"].map(
    (key) => `jobs.salaryMode.${key}`,
  ),
  ...["daily", "weekly", "monthly"].map(
    (key) => `jobs.rentalPeriod.${key}`,
  ),
  ...[
    "new",
    "viewed",
    "shortlisted",
    "interview",
    "offer",
    "accepted",
    "rejected",
    "withdrawn",
  ].map((key) => `jobs.applicationStatus.${key}`),
  "jobs.salary.rent",
  "jobs.salary.rentAgreement",
  "jobs.salary.revenuePercent",
  "jobs.salary.agreement",
  "jobs.salary.intern",
  "jobs.salary.from",
  "jobs.salary.to",
  "jobs.shared.report.reasonRequired",
  "jobs.shared.report.success",
  "jobs.shared.report.failure",
  "jobs.shared.report.button",
  "jobs.shared.report.titleListing",
  "jobs.shared.report.titleResume",
  "jobs.shared.report.placeholder",
  "jobs.shared.report.cancel",
  "jobs.shared.report.submit",
  "jobs.shared.loadError",
  "jobs.shared.retry",
  "jobs.location.regionLabel",
  "jobs.location.districtLabel",
  "jobs.location.all",
  "jobs.location.choose",
  "jobs.location.regionFirst",
] as const;

function lookup(dictionary: TranslationDictionary, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    return (value as TranslationDictionary)[part];
  }, dictionary);
}

describe("jobs localization", () => {
  it.each(SUPPORTED_LANGUAGES)(
    "%s has every jobs UI translation in ops",
    async (language) => {
      const dictionary = (await localeImporters.ops![language]()).default;

      for (const key of jobsKeys) {
        const value = lookup(dictionary, key);
        expect(value, `ops:${language}:${key}`).toEqual(expect.any(String));
        expect(String(value).trim()).not.toBe("");
      }
    },
  );

  it("the jobs route loads ops translations", () => {
    expect(getAppTranslationNamespaces("/jobs")).toContain("ops");
  });
});
