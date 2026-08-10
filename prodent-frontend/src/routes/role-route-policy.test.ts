import { describe, expect, it } from "vitest";
import { canAccessRoleRoute } from "./role-route-policy";

describe("role route policy", () => {
  it.each([
    ["assistant", { globalRoles: ["assistant"] }],
    ["assistant", { globalRoles: ["super_admin"] }],
    ["assistant", { membershipRoles: ["assistant"] }],
    ["accountant", { globalRoles: ["accountant"] }],
    ["accountant", { globalRoles: ["super_admin"] }],
    ["accountant", { membershipRoles: ["accountant"] }],
    ["manager", { globalRoles: ["clinic_manager"] }],
    ["manager", { globalRoles: ["super_admin"] }],
    ["manager", { membershipRoles: ["clinic_manager"] }],
    ["manager", { membershipRoles: ["clinic_admin"] }],
    ["clinic-admin", { globalRoles: ["clinic_admin"] }],
    ["clinic-admin", { globalRoles: ["super_admin"] }],
    ["clinic-admin", { globalRoles: ["admin"] }],
    ["clinic-admin", { membershipRoles: ["clinic_admin"] }],
    ["crm", { resolvedRole: "doctor" }],
    ["crm", { resolvedRole: "clinic_admin" }],
    ["crm", { resolvedRole: "assistant" }],
    ["crm", { resolvedRole: "accountant" }],
    ["doctor", { resolvedRole: "doctor" }],
    ["doctor", { resolvedRole: "clinic_manager" }],
    ["medical", { resolvedRole: "doctor" }],
    ["medical", { resolvedRole: "clinic_admin" }],
  ] as const)("allows %s with matching access", (group, access) => {
    expect(canAccessRoleRoute(group, access)).toBe(true);
  });

  it.each([
    ["assistant", { globalRoles: ["accountant"] }],
    ["assistant", { membershipRoles: ["clinic_admin"] }],
    ["accountant", { globalRoles: ["assistant"] }],
    ["accountant", { membershipRoles: ["clinic_manager"] }],
    ["manager", { globalRoles: ["clinic_admin"] }],
    ["manager", { membershipRoles: ["accountant"] }],
    ["manager", {}],
    ["clinic-admin", { globalRoles: ["clinic_manager"] }],
    ["clinic-admin", { membershipRoles: ["admin"] }],
    ["crm", { resolvedRole: "patient" }],
    ["crm", { resolvedRole: "moderator" }],
    ["doctor", { resolvedRole: "patient" }],
    ["doctor", { globalRoles: ["doctor"] }],
    ["medical", { resolvedRole: "assistant" }],
    ["medical", { resolvedRole: "accountant" }],
  ] as const)("denies %s without matching access", (group, access) => {
    expect(canAccessRoleRoute(group, access)).toBe(false);
  });

  it("does not widen access for malformed role values", () => {
    expect(
      canAccessRoleRoute("assistant", {
        globalRoles: ["  SUPER_ADMIN  "],
      }),
    ).toBe(false);
  });
});
