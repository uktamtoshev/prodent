import { describe, expect, it } from "vitest";
import { canShowJobContacts, isJobsAuthorized } from "./jobs-access";

describe("Jobs access and PII policy", () => {
  it("keeps the feed and details behind authentication", () => {
    expect(isJobsAuthorized(false, "doctor")).toBe(false);
    expect(isJobsAuthorized(true, null)).toBe(false);
    expect(isJobsAuthorized(true, "patient")).toBe(false);
    expect(isJobsAuthorized(true, "doctor")).toBe(true);
    expect(isJobsAuthorized(true, "clinic_admin")).toBe(true);
  });

  it("shows contact PII only when the server explicitly allows it", () => {
    expect(canShowJobContacts(undefined)).toBe(false);
    expect(canShowJobContacts(false)).toBe(false);
    expect(canShowJobContacts(true)).toBe(true);
  });
});
