const UZ_COUNTRY_CODE = "998";
const UZ_LOCAL_DIGITS = 9;

function uzDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith(UZ_COUNTRY_CODE)) {
    return digits.slice(0, UZ_COUNTRY_CODE.length + UZ_LOCAL_DIGITS);
  }
  return `${UZ_COUNTRY_CODE}${digits}`.slice(
    0,
    UZ_COUNTRY_CODE.length + UZ_LOCAL_DIGITS,
  );
}

export function normalizeUzPhone(value: string): string {
  return `+${uzDigits(value)}`;
}

export function formatUzPhone(value: string): string {
  const digits = uzDigits(value);
  const local = digits.slice(UZ_COUNTRY_CODE.length);
  let formatted = "+998";
  if (local.length > 0) formatted += ` ${local.slice(0, 2)}`;
  if (local.length > 2) formatted += ` ${local.slice(2, 5)}`;
  if (local.length > 5) formatted += ` ${local.slice(5, 7)}`;
  if (local.length > 7) formatted += ` ${local.slice(7, 9)}`;
  return formatted;
}

export function isValidUzPhone(value: string): boolean {
  if (/[^\d+\s()-]/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return /^998\d{9}$/.test(digits);
}

function sanitizeLocalPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if (
    value.includes("\\") ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) {
    return null;
  }

  try {
    const origin = "https://prodent.local";
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function getSafeReturnTo(
  search: string,
  state?: unknown,
): string | null {
  const params = new URLSearchParams(search);
  const fromQuery = params.get("returnTo") ?? params.get("return_to");
  const safeQuery = sanitizeLocalPath(fromQuery);
  if (safeQuery) return safeQuery;

  if (state && typeof state === "object" && "returnTo" in state) {
    return sanitizeLocalPath((state as { returnTo?: unknown }).returnTo);
  }
  return null;
}

export function buildAuthCallbackUrl(origin: string, returnTo?: string | null): string {
  const url = new URL("/auth/callback", origin);
  const safeReturnTo = sanitizeLocalPath(returnTo);
  if (safeReturnTo) url.searchParams.set("returnTo", safeReturnTo);
  return url.toString();
}

export async function exchangeOAuthCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const response = await fetch("/api/v1/auth/oauth/exchange", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    refresh_token?: unknown;
    message?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok) {
    const message =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (
    typeof body?.access_token !== "string" ||
    typeof body.refresh_token !== "string"
  ) {
    throw new Error("OAuth exchange returned an invalid session");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}
