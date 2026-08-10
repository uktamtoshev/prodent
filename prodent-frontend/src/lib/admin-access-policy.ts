export type PlatformAdminRole = "super_admin" | "admin" | "moderator";

const MODERATOR_PATHS = new Set([
  "/admin/moderation",
  "/admin/reviews",
  "/admin/market/products",
  "/admin/market/reviews",
  "/admin/market/disputes",
]);

const SUPER_ADMIN_ONLY_PATHS = new Set(["/admin/integrations"]);

export function isPlatformAdminRole(role: string | null | undefined): role is PlatformAdminRole {
  return role === "super_admin" || role === "admin" || role === "moderator";
}

export function canAccessAdminPath(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (!isPlatformAdminRole(role)) return false;
  if (role === "super_admin") return true;
  if (role === "moderator") return MODERATOR_PATHS.has(pathname);
  return !SUPER_ADMIN_ONLY_PATHS.has(pathname);
}

export function adminHomeForRole(role: string | null | undefined): string {
  return role === "moderator" ? "/admin/moderation" : "/admin";
}

export const moderatorAdminPaths = Object.freeze([...MODERATOR_PATHS]);
