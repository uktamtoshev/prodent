import { describe, expect, it } from "vitest";
import { notificationDeepLink } from "./notification-deep-link";

describe("notificationDeepLink", () => {
  it("keeps an explicit safe in-app link", () => {
    expect(notificationDeepLink("lab_order_ready", { link: "/lab/orders/42" })).toBe("/lab/orders/42");
  });

  it("routes job application events to the matching Jobs tab", () => {
    expect(notificationDeepLink("job_application", { application_id: "42" })).toBe(
      "/jobs/my?tab=applications",
    );
    expect(notificationDeepLink("JOB_APPLICATION", { application_id: "42" })).toBe(
      "/jobs/my?tab=applications",
    );
  });

  it("rejects external and protocol-relative links", () => {
    expect(notificationDeepLink("general", { link: "https://evil.example" })).toBeNull();
    expect(notificationDeepLink("general", { link: "//evil.example" })).toBeNull();
    expect(notificationDeepLink("general", { link: "/\\evil.example" })).toBeNull();
  });
});
