const PREFIX = "prodent_lab_draft";

function key(kind: string, userId: string): string {
  return `${PREFIX}:${userId}:${kind}`;
}

export function saveLabDraft<T>(kind: string, userId: string | undefined, value: T): void {
  if (!userId) return;
  localStorage.setItem(key(kind, userId), JSON.stringify(value));
}

export function loadLabDraft<T>(
  kind: string,
  userId: string | undefined,
  fallback: T,
): T {
  if (!userId) return fallback;
  try {
    const stored = localStorage.getItem(key(kind, userId));
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function clearLabDraft(kind: string, userId: string | undefined): void {
  if (userId) localStorage.removeItem(key(kind, userId));
}

export function loadOrCreateLabRequestId(
  kind: string,
  userId: string | undefined,
  generate: () => string = () => crypto.randomUUID(),
): string {
  if (!userId) throw new Error("AUTH_REQUIRED");
  const requestKind = `${kind}-request-id`;
  const existing = loadLabDraft<unknown>(requestKind, userId, null);
  if (typeof existing === "string" && existing.trim()) return existing;
  const requestId = generate();
  saveLabDraft(requestKind, userId, requestId);
  return requestId;
}
