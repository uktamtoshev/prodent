const MODULE_ROLES = new Set([
  "super_admin",
  "admin",
  "moderator",
  "doctor",
  "clinic_admin",
  "clinic_manager",
]);

export const JOBS_CLINIC_ROLES = new Set(["super_admin", "admin", "clinic_admin", "clinic_manager"]);
export const JOBS_MODERATOR_ROLES = new Set(["super_admin", "admin", "moderator"]);

export function isJobsAuthorized(authenticated: boolean, role: string | null | undefined): boolean {
  return authenticated && !!role && MODULE_ROLES.has(role);
}

export function canShowJobContacts(serverPermission: boolean | null | undefined): boolean {
  return serverPermission === true;
}
