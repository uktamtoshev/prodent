import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  listClinicMemberPermissions,
  isPermissionManagedMemberRole,
  resolveClinicMemberPermission,
  setClinicMemberPermission,
} from "./clinic-member-permissions-api";

describe("clinic member permissions API", () => {
  beforeEach(() => invoke.mockReset());

  it("loads permissions only through the dedicated scoped command", async () => {
    invoke.mockResolvedValue({
      data: [{
        id: "p1",
        clinicId: "c1",
        userId: "u1",
        module: "finance",
        canView: true,
        canEdit: false,
        canManage: false,
      }],
      error: null,
    });

    await expect(listClinicMemberPermissions("c1", "u1")).resolves.toEqual([
      expect.objectContaining({
        clinic_id: "c1",
        user_id: "u1",
        module: "finance",
        can_view: true,
      }),
    ]);
    expect(invoke).toHaveBeenCalledWith("clinic-permission-list", {
      body: { clinicId: "c1", userId: "u1" },
    });
  });

  it("writes permissions only through the dedicated admin command", async () => {
    const input = {
      clinicId: "c1",
      userId: "u1",
      module: "schedule",
      canView: true,
      canEdit: true,
      canManage: false,
    };
    invoke.mockResolvedValue({ data: { id: "p1", ...input }, error: null });

    await setClinicMemberPermission(input);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("clinic-permission-set", { body: input });
  });

  it("excludes patient memberships regardless of legacy role casing", () => {
    expect(isPermissionManagedMemberRole("patient")).toBe(false);
    expect(isPermissionManagedMemberRole("PATIENT")).toBe(false);
    expect(isPermissionManagedMemberRole("Assistant")).toBe(true);
  });

  it("lets an explicit false permission override a role default", () => {
    const permissions = [{
      module: "schedule",
      can_view: false,
      can_edit: false,
      can_manage: false,
    }];
    expect(resolveClinicMemberPermission(
      permissions,
      "schedule",
      "view",
      true,
    )).toBe(false);
    expect(resolveClinicMemberPermission([], "schedule", "view", true)).toBe(true);
  });
});
