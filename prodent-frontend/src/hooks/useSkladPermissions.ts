import { useClinic } from "@/contexts/ClinicContext";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

const STOCK_ROLES = new Set<AppRole>([
  "super_admin",
  "admin",
  "doctor",
  "clinic_admin",
  "assistant",
]);

const CATALOG_ROLES = new Set<AppRole>([
  "super_admin",
  "admin",
  "doctor",
  "clinic_admin",
]);

export function resolveSkladPermissions(role: AppRole | null) {
  return {
    canMutateStock: role ? STOCK_ROLES.has(role) : false,
    canManageCatalog: role ? CATALOG_ROLES.has(role) : false,
  };
}

export function useSkladPermissions() {
  const { role } = useUserRole();
  const { currentClinic, isSuperAdmin } = useClinic();
  const selectedClinicRole = currentClinic?.role as AppRole | undefined;
  const effectiveRole =
    isSuperAdmin || role === "admin" || role === "super_admin"
      ? role
      : selectedClinicRole ?? role;

  return resolveSkladPermissions(effectiveRole);
}
