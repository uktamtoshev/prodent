import { describe, expect, it } from "vitest";
import {
  JOBS_MY_TABS,
  listingFiltersFromSearchParams,
  listingFiltersToSearchParams,
  jobsMessagesPath,
  normalizeJobsMyTab,
} from "./jobs-navigation";

describe("jobs navigation state", () => {
  it("round-trips supported listing filters and ignores unknown parameters", () => {
    const params = new URLSearchParams(
      "listing_type=vacancy&category=dentist&city=tashkent&district=yunusabad&q=ortho&sort=expensive&unknown=secret",
    );

    const filters = listingFiltersFromSearchParams(params);

    expect(filters).toEqual({
      listing_type: "vacancy",
      category: "dentist",
      city: "tashkent",
      district: "yunusabad",
      q: "ortho",
      sort: "expensive",
    });
    expect(listingFiltersToSearchParams(filters).get("unknown")).toBeNull();
  });

  it("keeps only a known My Jobs tab in a deep link", () => {
    expect(normalizeJobsMyTab("applications", false)).toBe("applications");
    expect(normalizeJobsMyTab("candidates", false)).toBe("candidates");
    expect(normalizeJobsMyTab("resume", true)).toBe("listings");
    expect(normalizeJobsMyTab("bad-value", false)).toBe("resume");
    expect(JOBS_MY_TABS.seeker).toContain("applications");
    expect(jobsMessagesPath("doctor")).toBe("/doctor/messages");
    expect(jobsMessagesPath("clinic_admin")).toBe("/clinic-admin/messages");
    expect(jobsMessagesPath("clinic_manager")).toBe("/crm/messages");
    expect(jobsMessagesPath("assistant")).toBe("/crm/messages");
    expect(jobsMessagesPath("technician")).toBe("/technician/messages");
    expect(jobsMessagesPath("patient")).toBe("/patient/messages");
    expect(jobsMessagesPath("moderator")).toBeNull();
    expect(jobsMessagesPath("unknown")).toBeNull();
  });
});
