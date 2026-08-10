import { describe, expect, it } from "vitest";

import { getHomeRoute, getHomeRouteFromProfile } from "./roleHome";

describe("role home routing", () => {
  it("normalizes role case and whitespace", () => {
    expect(getHomeRoute(["  DoCtOr  "])).toBe("/crm");
  });

  it("uses the highest-priority route when a user has several roles", () => {
    expect(getHomeRoute(["patient", "doctor", "SUPER_ADMIN"])).toBe("/admin");
  });

  it("keeps unknown and missing roles on the public landing page", () => {
    expect(getHomeRoute(["unknown-role"])).toBe("/");
    expect(getHomeRoute()).toBe("/");
  });

  it("prefers roles from the live user over cached profile roles", () => {
    localStorage.setItem(
      "prodent_user_profile",
      JSON.stringify({ roles: ["patient"] }),
    );

    expect(
      getHomeRouteFromProfile({ user_metadata: { roles: ["clinic_manager"] } }),
    ).toBe("/manager/dashboard");
  });

  it("falls back to cached roles and ignores corrupt cache", () => {
    localStorage.setItem(
      "prodent_user_profile",
      JSON.stringify({ roles: ["patient"] }),
    );
    expect(getHomeRouteFromProfile()).toBe("/patient");

    localStorage.setItem("prodent_user_profile", "not-json");
    expect(getHomeRouteFromProfile()).toBe("/");
  });
});
