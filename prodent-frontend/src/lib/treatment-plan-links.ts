const PUBLIC_API = "/api/v1/public/treatment-plans";
const PRIVATE_API = "/api/v1/treatment-plans";
const ACCESS_TOKEN_KEY = "prodent_access_token";

export type TreatmentPlanStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface PublicTreatmentPlanItem {
  position: number;
  toothNumber: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: TreatmentPlanStatus;
}

export interface PublicTreatmentPlan {
  title: string;
  status: TreatmentPlanStatus;
  totalCost: number;
  currency: string;
  createdAt: string;
  approvedAt: string | null;
  doctorName: string;
  clinicName: string;
  expiresAt: string;
  items: PublicTreatmentPlanItem[];
}

export interface CreatedTreatmentPlanLink {
  token: string;
  expiresAt: string;
}

export class TreatmentPlanLinkError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TreatmentPlanLinkError";
  }
}

const PLAN_STATUSES = new Set<TreatmentPlanStatus>([
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TreatmentPlanLinkError(`Invalid ${field}`, 502);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new TreatmentPlanLinkError(`Invalid ${field}`, 502);
  }
  return value;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TreatmentPlanLinkError(`Invalid ${field}`, 502);
  }
  return value;
}

function planStatus(value: unknown, field: string): TreatmentPlanStatus {
  if (typeof value !== "string" || !PLAN_STATUSES.has(value as TreatmentPlanStatus)) {
    throw new TreatmentPlanLinkError(`Invalid ${field}`, 502);
  }
  return value as TreatmentPlanStatus;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TreatmentPlanLinkError("Invalid server response", response.status || 502);
  }
}

function parsePublicPlan(value: unknown): PublicTreatmentPlan {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new TreatmentPlanLinkError("Invalid public treatment plan", 502);
  }

  const items = value.items.map((rawItem, index): PublicTreatmentPlanItem => {
    if (!isRecord(rawItem)) {
      throw new TreatmentPlanLinkError("Invalid treatment plan item", 502);
    }
    const toothNumber = rawItem.toothNumber;
    if (toothNumber !== null && (typeof toothNumber !== "number" || !Number.isInteger(toothNumber))) {
      throw new TreatmentPlanLinkError("Invalid items.toothNumber", 502);
    }
    return {
      position: finiteNumber(rawItem.position, `items[${index}].position`),
      toothNumber,
      description: requiredString(rawItem.description, `items[${index}].description`),
      quantity: finiteNumber(rawItem.quantity, `items[${index}].quantity`),
      unitPrice: finiteNumber(rawItem.unitPrice, `items[${index}].unitPrice`),
      totalPrice: finiteNumber(rawItem.totalPrice, `items[${index}].totalPrice`),
      status: planStatus(rawItem.status, `items[${index}].status`),
    };
  });

  return {
    title: requiredString(value.title, "title"),
    status: planStatus(value.status, "status"),
    totalCost: finiteNumber(value.totalCost, "totalCost"),
    currency: requiredString(value.currency, "currency").toUpperCase(),
    createdAt: requiredString(value.createdAt, "createdAt"),
    approvedAt: nullableString(value.approvedAt, "approvedAt"),
    doctorName: requiredString(value.doctorName, "doctorName"),
    clinicName: requiredString(value.clinicName, "clinicName"),
    expiresAt: requiredString(value.expiresAt, "expiresAt"),
    items,
  };
}

function errorMessage(body: unknown, fallback: string): string {
  if (isRecord(body) && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  return fallback;
}

export async function resolvePublicTreatmentPlan(
  token: string,
  signal?: AbortSignal,
): Promise<PublicTreatmentPlan> {
  const response = await fetch(`${PUBLIC_API}/resolve`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new TreatmentPlanLinkError(
      errorMessage(body, `HTTP ${response.status}`),
      response.status,
    );
  }
  return parsePublicPlan(body);
}

async function privateRequest(path: string, method: "POST" | "DELETE"): Promise<unknown> {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    throw new TreatmentPlanLinkError("Authentication required", 401);
  }
  const response = await fetch(`${PRIVATE_API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new TreatmentPlanLinkError(
      errorMessage(body, `HTTP ${response.status}`),
      response.status,
    );
  }
  return body;
}

export async function createTreatmentPlanShareLink(
  planId: string,
): Promise<CreatedTreatmentPlanLink> {
  const body = await privateRequest(`/${encodeURIComponent(planId)}/share-link`, "POST");
  if (!isRecord(body)) {
    throw new TreatmentPlanLinkError("Invalid share link response", 502);
  }
  return {
    token: requiredString(body.token, "token"),
    expiresAt: requiredString(body.expiresAt, "expiresAt"),
  };
}

export async function revokeTreatmentPlanShareLink(planId: string): Promise<void> {
  await privateRequest(`/${encodeURIComponent(planId)}/share-link`, "DELETE");
}

export function buildTreatmentPlanPublicUrl(token: string): string {
  return `${window.location.origin}/treatment-plan#t=${encodeURIComponent(token)}`;
}
