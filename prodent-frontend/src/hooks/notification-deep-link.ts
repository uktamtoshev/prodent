export function notificationDeepLink(
  type: string,
  metadata: Record<string, unknown> | null | undefined,
  explicitLink?: string | null,
): string | null {
  const candidate =
    explicitLink ??
    (typeof metadata?.link === "string" ? metadata.link : null);

  // Only same-application paths are allowed. This also keeps notification
  // payloads from turning into an open redirect.
  if (candidate?.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) {
    return candidate;
  }
  if (type.toLowerCase() === "job_application") return "/jobs/my?tab=applications";
  return null;
}
