import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useUserRole } from "./useUserRole";
import {
  listClinicMemberPermissions,
  resolveClinicMemberPermission,
} from "@/lib/clinic-member-permissions-api";

export type ModuleName =
  | "finance"
  | "schedule"
  | "patients"
  | "medical_records"
  | "treatment_plans"
  | "tasks"
  | "settings"
  | "team"
  | "reports"
  | "inventory"
  | "laboratory"
  | "services";

export type PermissionLevel = "view" | "edit" | "manage";

interface ModulePermission {
  module: string;
  can_view: boolean;
  can_edit: boolean;
  can_manage: boolean;
}

export function useModulePermissions() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { isSuperAdmin, isClinicAdmin, isDoctor, isAssistant, isAccountant, isClinicManager } = useUserRole();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["module-permissions", user?.id, currentClinic?.id],
    queryFn: async () => {
      if (!user?.id || !currentClinic?.id) return [];

      return (await listClinicMemberPermissions(
        currentClinic.id,
        user.id,
      )) as ModulePermission[];
    },
    enabled: !!user?.id && !!currentClinic?.id,
  });

  const hasPermission = (module: ModuleName, level: PermissionLevel = "view"): boolean => {
    // Super admins and clinic admins always have full access
    if (isSuperAdmin || isClinicAdmin) return true;

    // Default view access by role for clinical modules — until explicit
    // permissions are set in clinic_member_permissions
    const DEFAULTS: Record<string, ModuleName[]> = {
      doctor: [
        "schedule",
        "patients",
        "medical_records",
        "treatment_plans",
        "tasks",
        "laboratory",
        "services",
        "inventory",
      ],
      assistant: [
        "schedule",
        "patients",
        "medical_records",
        "tasks",
        "laboratory",
      ],
      // Accountant (бухгалтер) and clinic_manager (ресепшен/директор) run the
      // clinic warehouse — the standalone Склад module (/sklad) reads its menu
      // visibility from here; the server (SkladController) allows both roles too.
      accountant: ["finance", "reports", "inventory"],
      clinic_manager: [
        "schedule",
        "patients",
        "medical_records",
        "treatment_plans",
        "tasks",
        "laboratory",
        "services",
        "team",
        "reports",
        "inventory",
      ],
    };
    const roleKey = isDoctor
      ? "doctor"
      : isAssistant
      ? "assistant"
      : isAccountant
      ? "accountant"
      : isClinicManager
      ? "clinic_manager"
      : null;
    const hasExplicitPermission = (permissions || []).some(
      (permission) => permission.module === module,
    );
    // Clinic managers already manage the price list in the dedicated manager
    // cabinet. Keep that role default, while an explicit false row still revokes it.
    if (!hasExplicitPermission
        && roleKey === "clinic_manager"
        && module === "services"
        && (level === "edit" || level === "manage")) {
      return true;
    }
    const defaultView = Boolean(
      level === "view" &&
      roleKey &&
      DEFAULTS[roleKey]?.includes(module),
    );
    return resolveClinicMemberPermission(
      permissions || [],
      module,
      level,
      defaultView,
    );
  };

  const canView = (module: ModuleName) => hasPermission(module, "view");
  const canEdit = (module: ModuleName) => hasPermission(module, "edit");
  const canManage = (module: ModuleName) => hasPermission(module, "manage");

  return {
    permissions: permissions || [],
    isLoading,
    hasPermission,
    canView,
    canEdit,
    canManage,
  };
}
