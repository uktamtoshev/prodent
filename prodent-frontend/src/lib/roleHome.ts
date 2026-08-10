/**
 * Single source of truth for "where does a role land after login".
 *
 * Previously every successful login navigated to "/" (the marketing landing),
 * so a patient/doctor/admin had to find their own cabinet by hand. This maps a
 * user's roles to their primary cabinet so the post-login redirect drops them
 * exactly where they work.
 *
 * Roles arrive in mixed case (user_roles stores UPPERCASE, the profile shim
 * lower/other), so everything is normalised to lowercase before matching.
 */

const USER_PROFILE_KEY = "prodent_user_profile";

// Highest-privilege first: a user with several roles lands in the most capable
// cabinet (e.g. a super_admin who is also a doctor goes to /admin).
const ROLE_HOME: Array<[string, string]> = [
  ["super_admin", "/admin"],
  ["admin", "/admin"],
  ["moderator", "/admin/moderation"],
  ["clinic_admin", "/crm"], // dedicated clinic-admin cabinet is still stubbed; CRM is the working one
  ["clinic_manager", "/manager/dashboard"],
  ["manager", "/manager/dashboard"],
  ["accountant", "/accountant/invoices"],
  ["assistant", "/assistant/schedule"],
  ["doctor", "/crm"],
  ["seller", "/seller"],
  ["technician", "/technician"],
  ["patient", "/patient"],
];

function normalize(roles?: Array<string | null | undefined> | null): string[] {
  return (roles ?? [])
    .map((r) => (r ?? "").toString().toLowerCase().trim())
    .filter(Boolean);
}

/**
 * Resolve the home route for a set of roles. Unknown roles go to the landing
 * page instead of silently receiving the PATIENT cabinet.
 */
export function getHomeRoute(
  roles?: Array<string | null | undefined> | null,
): string {
  const normalized = normalize(roles);
  for (const [role, route] of ROLE_HOME) {
    if (normalized.includes(role)) return route;
  }
  return "/";
}

/**
 * Read the cached profile from localStorage and resolve its home route.
 * Used right after login, where the profile shim has already cached the user.
 */
export function getHomeRouteFromProfile(user?: { user_metadata?: Record<string, unknown> } | null): string {
  // Prefer roles attached to the live user object when available.
  const fromUser = user?.user_metadata?.roles;
  if (Array.isArray(fromUser) && fromUser.length) return getHomeRoute(fromUser);

  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) {
      const profile = JSON.parse(raw);
      if (Array.isArray(profile?.roles)) return getHomeRoute(profile.roles);
    }
  } catch {
    /* corrupt cache — fall through to default */
  }
  return "/";
}
