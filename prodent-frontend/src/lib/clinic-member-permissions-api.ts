import { supabase } from "@/integrations/supabase/client";

export interface ClinicMemberPermission {
  id: string;
  clinic_id: string;
  user_id: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
  can_manage: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ClinicPermissionLevel = "view" | "edit" | "manage";

export function resolveClinicMemberPermission(
  permissions: Pick<
    ClinicMemberPermission,
    "module" | "can_view" | "can_edit" | "can_manage"
  >[],
  module: string,
  level: ClinicPermissionLevel,
  defaultView: boolean,
): boolean {
  const explicit = permissions.find((permission) => permission.module === module);
  if (!explicit) return level === "view" && defaultView;
  if (level === "view") return explicit.can_view;
  if (level === "edit") return explicit.can_edit;
  return explicit.can_manage;
}

export interface SetClinicMemberPermissionInput {
  clinicId: string;
  userId: string;
  module: string;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
}

export function isPermissionManagedMemberRole(role: string | null | undefined): boolean {
  return role?.toLowerCase() !== "patient";
}

type PermissionWire = Partial<ClinicMemberPermission> & {
  clinicId?: string;
  userId?: string;
  canView?: boolean;
  canEdit?: boolean;
  canManage?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function fromWire(row: PermissionWire): ClinicMemberPermission {
  return {
    id: row.id ?? "",
    clinic_id: row.clinic_id ?? row.clinicId ?? "",
    user_id: row.user_id ?? row.userId ?? "",
    module: row.module ?? "",
    can_view: row.can_view ?? row.canView ?? false,
    can_edit: row.can_edit ?? row.canEdit ?? false,
    can_manage: row.can_manage ?? row.canManage ?? false,
    created_at: row.created_at ?? row.createdAt,
    updated_at: row.updated_at ?? row.updatedAt,
  };
}

export async function listClinicMemberPermissions(
  clinicId: string,
  userId: string,
): Promise<ClinicMemberPermission[]> {
  const { data, error } = await supabase.functions.invoke("clinic-permission-list", {
    body: { clinicId, userId },
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(fromWire);
}

export async function setClinicMemberPermission(
  input: SetClinicMemberPermissionInput,
): Promise<ClinicMemberPermission> {
  const { data, error } = await supabase.functions.invoke("clinic-permission-set", {
    body: input,
  });
  if (error) throw error;
  return fromWire((data ?? {}) as PermissionWire);
}
