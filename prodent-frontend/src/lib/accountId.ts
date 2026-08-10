/**
 * Display form of a user's account id.
 *
 * Every user carries two ids: the uuid primary key, and `profiles.account_number`
 * — an eight-digit number allocated by the database (V131), random and never
 * starting with 0, meant to be read out loud to support or a receptionist.
 * Prefer the number. The uuid formatting below stays as the fallback for rows
 * that predate the number (or a query that did not select it): a full uuid is 36
 * characters and does not fit the 256px sidebar without wrapping onto three
 * lines, so the first sixteen hex characters are grouped into four readable
 * blocks. Callers keep the full value in a `title` for exact lookup.
 */
export function formatAccountId(id: string | null | undefined): string | null {
  if (!id) return null;
  const hex = id.replace(/-/g, "").toUpperCase();
  if (!hex) return null;
  if (hex.length < 16) return hex;

  const stablePrefix = hex.slice(0, 16);
  return [
    stablePrefix.slice(0, 4),
    stablePrefix.slice(4, 8),
    stablePrefix.slice(8, 12),
    stablePrefix.slice(12, 16),
  ].join("-");
}

/**
 * Card code the staff cabinets print for a patient, without the `#P-` prefix the
 * call sites add themselves.
 *
 * The patient's eight-digit account number when the query selected it; otherwise
 * the first four hex characters of the uuid, which is what every one of these
 * screens printed before the number existed. Keeping the fallback means a screen
 * that has not been repointed yet still shows *something* stable rather than an
 * empty code.
 */
export function formatPatientCardId(
  accountNumber: string | null | undefined,
  patientId: string | null | undefined,
): string {
  if (accountNumber) return accountNumber;
  if (!patientId) return "";
  return patientId.slice(0, 4).toUpperCase();
}
