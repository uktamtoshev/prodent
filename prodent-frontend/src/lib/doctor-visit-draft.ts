export const DOCTOR_VISIT_DRAFT_VERSION = 2;

export interface DoctorVisitDraft {
  version: typeof DOCTOR_VISIT_DRAFT_VERSION;
  complaints: string;
  examination: string;
  diagnosis: string;
  anesthesia: string;
  procedures: string;
  recommendations: string;
  privateNotes: string;
  serverVersion: number | null;
  updatedAt: string | null;
}

interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
}

const fields = [
  "complaints",
  "examination",
  "diagnosis",
  "anesthesia",
  "procedures",
  "recommendations",
  "privateNotes",
] as const;

const draftKey = (userId: string, visitId: string) =>
  `prodent:doctor-visit-draft:${userId}:${visitId}`;
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;

export function createEmptyDoctorVisitDraft(): DoctorVisitDraft {
  return {
    version: DOCTOR_VISIT_DRAFT_VERSION,
    complaints: "",
    examination: "",
    diagnosis: "",
    anesthesia: "",
    procedures: "",
    recommendations: "",
    privateNotes: "",
    serverVersion: null,
    updatedAt: null,
  };
}

function isDraft(value: unknown): value is DoctorVisitDraft {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.version === DOCTOR_VISIT_DRAFT_VERSION
    && fields.every((field) => typeof record[field] === "string")
    && (record.serverVersion === null
      || (typeof record.serverVersion === "number"
        && Number.isSafeInteger(record.serverVersion)
        && record.serverVersion >= 0))
    && (record.updatedAt === null || typeof record.updatedAt === "string");
}

export function loadDoctorVisitDraft(
  storage: DraftStorage,
  userId: string,
  visitId: string,
): DoctorVisitDraft {
  try {
    // Ownership of the legacy unscoped draft cannot be proven. Never migrate
    // clinical content from it to whichever doctor happens to sign in next.
    storage.removeItem(`prodent:doctor-visit-draft:${visitId}`);
    const raw = storage.getItem(draftKey(userId, visitId));
    if (!raw) return createEmptyDoctorVisitDraft();
    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed)) return createEmptyDoctorVisitDraft();
    if (
      parsed.updatedAt
      && Date.now() - new Date(parsed.updatedAt).getTime() > MAX_DRAFT_AGE_MS
    ) {
      storage.removeItem(draftKey(userId, visitId));
      return createEmptyDoctorVisitDraft();
    }
    return parsed;
  } catch {
    return createEmptyDoctorVisitDraft();
  }
}

export function saveDoctorVisitDraft(
  storage: DraftStorage,
  userId: string,
  visitId: string,
  draft: DoctorVisitDraft,
  serverVersion: number | null = draft.serverVersion,
): DoctorVisitDraft {
  const persisted = {
    ...draft,
    serverVersion,
    updatedAt: new Date().toISOString(),
  };
  storage.setItem(draftKey(userId, visitId), JSON.stringify(persisted));
  return persisted;
}

export function clearDoctorVisitDraft(
  storage: DraftStorage,
  userId: string,
  visitId: string,
) {
  storage.removeItem(draftKey(userId, visitId));
}

export function hasDoctorVisitDraftContent(draft: DoctorVisitDraft): boolean {
  return fields.some((field) => draft[field].trim().length > 0);
}

function clinicalContentFingerprint(draft: DoctorVisitDraft): string {
  return JSON.stringify(fields.map((field) => draft[field].trim()));
}

export type DoctorVisitDraftReconciliation = {
  kind: "server" | "local" | "conflict";
  draft: DoctorVisitDraft;
};

/**
 * Reconciles a device draft with the latest server document without silently
 * overwriting newer clinical data.
 */
export function reconcileDoctorVisitDrafts(
  serverDraft: DoctorVisitDraft,
  localDraft: DoctorVisitDraft,
  serverVersion: number,
): DoctorVisitDraftReconciliation {
  if (!hasDoctorVisitDraftContent(localDraft)) {
    return { kind: "server", draft: serverDraft };
  }
  if (
    clinicalContentFingerprint(localDraft)
    === clinicalContentFingerprint(serverDraft)
  ) {
    return { kind: "server", draft: serverDraft };
  }

  if (localDraft.serverVersion === serverVersion) {
    return { kind: "local", draft: localDraft };
  }

  // Different base versions plus different content means both copies may have
  // changed. Wall clocks are not trusted: device time can be wrong offline.
  return { kind: "conflict", draft: localDraft };
}

export function canFinishDoctorVisit(
  hasUnresolvedConflict: boolean,
  isPending: boolean,
): boolean {
  return !hasUnresolvedConflict && !isPending;
}

export function canEditDoctorVisitDraft(isFinishing: boolean): boolean {
  return !isFinishing;
}

export function shouldClearDoctorVisitDraftForAccessStatus(
  status: number,
): boolean {
  return status === 401 || status === 403;
}

export function buildMedicalRecordNotes(draft: DoctorVisitDraft): string | null {
  const sections: Array<[string, string]> = [
    ["Жалобы", draft.complaints],
    ["Осмотр", draft.examination],
    ["Рекомендации", draft.recommendations],
  ];
  const result = sections
    .filter(([, value]) => value.trim())
    .map(([title, value]) => `${title}:\n${value.trim()}`)
    .join("\n\n");
  return result || null;
}

export function parseMedicalRecordNotes(notes: string | null): Partial<DoctorVisitDraft> {
  if (!notes?.trim()) return {};
  const labels: Array<[keyof DoctorVisitDraft, string]> = [
    ["complaints", "Жалобы"],
    ["examination", "Осмотр"],
    ["recommendations", "Рекомендации"],
  ];
  const parsed: Partial<DoctorVisitDraft> = {};
  for (const [field, label] of labels) {
    const nextLabels = labels
      .filter(([, candidate]) => candidate !== label)
      .map(([, candidate]) => candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const pattern = new RegExp(
      `${label}:\\n([\\s\\S]*?)(?=\\n\\n(?:${nextLabels}):\\n|$)`,
    );
    const match = notes.match(pattern);
    if (match?.[1]) parsed[field] = match[1].trim() as never;
  }
  if (Object.keys(parsed).length === 0) parsed.examination = notes.trim();
  return parsed;
}
