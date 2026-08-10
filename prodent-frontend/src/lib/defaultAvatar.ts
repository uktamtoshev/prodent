// Default profile-picture URLs shipped in /public. Used whenever a doctor or
// patient hasn't uploaded a custom avatar so we don't render initials over
// the user's clinic banner.

const MALE = "/doctor-default-male.png";
const FEMALE = "/doctor-default-female.png";

const FEMALE_TOKENS = new Set([
  "female", "f", "woman", "women",
  "женский", "женщина", "ж",
  "ayol", "ayollar", // uz
]);

/**
 * Resolve the avatar URL to render for a user/doctor.
 *
 * @param avatarUrl - the URL set on the profile (if any)
 * @param gender    - lowercased gender string from profiles.gender or users.gender
 *
 * Falls back to a gendered cartoon doctor when avatarUrl is missing.
 * Picks the female cartoon for any "female"-flavored gender token, otherwise
 * the male one — gender data is sparse, so neutrals get the male default.
 */
export function defaultDoctorAvatar(
  avatarUrl?: string | null,
  gender?: string | null
): string {
  if (avatarUrl) return avatarUrl;
  const g = (gender || "").trim().toLowerCase();
  return FEMALE_TOKENS.has(g) ? FEMALE : MALE;
}

/** Same logic but always returns the placeholder (used for explicit empty state). */
export function defaultDoctorPlaceholder(gender?: string | null): string {
  return defaultDoctorAvatar(null, gender);
}
