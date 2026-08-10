import { describe, expect, it } from "vitest";
import {
  adminHomeForRole,
  canAccessAdminPath,
  moderatorAdminPaths,
} from "./admin-access-policy";

describe("admin access policy", () => {
  it("keeps medical, financial and system pages away from moderators", () => {
    for (const path of [
      "/admin",
      "/admin/patients",
      "/admin/appointments",
      "/admin/payments",
      "/admin/lab",
      "/admin/users",
      "/admin/settings",
      "/admin/integrations",
    ]) {
      expect(canAccessAdminPath("moderator", path), path).toBe(false);
    }
  });

  it("allows moderators only into moderation and marketplace review work", () => {
    expect(moderatorAdminPaths).toEqual([
      "/admin/moderation",
      "/admin/reviews",
      "/admin/market/products",
      "/admin/market/reviews",
      "/admin/market/disputes",
    ]);
    for (const path of moderatorAdminPaths) {
      expect(canAccessAdminPath("moderator", path), path).toBe(true);
    }
  });

  it("reserves integrations for super admins", () => {
    expect(canAccessAdminPath("admin", "/admin/integrations")).toBe(false);
    expect(canAccessAdminPath("super_admin", "/admin/integrations")).toBe(true);
    expect(canAccessAdminPath("admin", "/admin/users")).toBe(true);
    expect(canAccessAdminPath("super_admin", "/admin/anything")).toBe(true);
    expect(adminHomeForRole("moderator")).toBe("/admin/moderation");
    expect(adminHomeForRole("admin")).toBe("/admin");
  });

  it("rejects missing and non-platform roles", () => {
    expect(canAccessAdminPath(null, "/admin")).toBe(false);
    expect(canAccessAdminPath(undefined, "/admin")).toBe(false);
    expect(canAccessAdminPath("patient", "/admin")).toBe(false);
    expect(adminHomeForRole(null)).toBe("/admin");
  });
});
