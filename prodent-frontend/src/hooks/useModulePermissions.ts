import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useUserRole } from "./useUserRole";

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
  const { isSuperAdmin, isClinicAdmin } = useUserRole();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["module-permissions", user?.id, currentClinic?.id],
    queryFn: async () => {
      if (!user?.id || !currentClinic?.id) return [];

      const { data } = await supabase
        .from("clinic_member_permissions")
        .select("module, can_view, can_edit, can_manage")
        .eq("clinic_id", currentClinic.id)
        .eq("user_id", user.id);

      return (data as ModulePermission[]) || [];
    },
    enabled: !!user?.id && !!currentClinic?.id,
  });

  const hasPermission = (module: ModuleName, level: PermissionLevel = "view"): boolean => {
    // Super admins and clinic admins always have full access
    if (isSuperAdmin || isClinicAdmin) return true;

    const perm = permissions?.find((p) => p.module === module);
    if (!perm) return false;

    switch (level) {
      case "view":
        return perm.can_view;
      case "edit":
        return perm.can_edit;
      case "manage":
        return perm.can_manage;
      default:
        return false;
    }
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
