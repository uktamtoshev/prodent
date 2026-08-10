import { supabase } from "@/integrations/supabase/client";

const API_BASE = "/api/v1/treatment-plans";

export type TreatmentPlanStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TreatmentPlanDiscountType = "PERCENT" | "FIXED";

export interface TreatmentPlanItemDto {
  id: string;
  serviceId: string | null;
  toothNumber: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: TreatmentPlanStatus;
  stageName: string | null;
  notes: string | null;
}

export interface TreatmentPlanDto {
  id: string;
  patientId: string;
  doctorName: string;
  clinicName: string;
  title: string;
  description: string | null;
  status: TreatmentPlanStatus;
  totalCost: number;
  discountType: TreatmentPlanDiscountType;
  discountValue: number;
  discountAmount: number;
  discountComment: string | null;
  patientConsentConfirmedAt: string | null;
  currency: string;
  items: TreatmentPlanItemDto[];
  createdAt: string;
}

export interface CreateTreatmentPlanItem {
  serviceId?: string | null;
  toothNumber?: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  stageName?: string | null;
  notes?: string | null;
}

export interface CreateTreatmentPlanRequest {
  patientId: string;
  clinicId: string;
  title: string;
  description?: string | null;
  discountType?: "PERCENT" | "FIXED";
  discountValue?: number;
  discountComment?: string | null;
  patientConsentConfirmed?: boolean;
  items: CreateTreatmentPlanItem[];
}

export interface UpdateTreatmentPlanItemRequest extends CreateTreatmentPlanItem {
  /** Existing item id. Omit it for a new item. */
  id?: string;
}

export interface UpdateTreatmentPlanRequest {
  title: string;
  description?: string | null;
  discountType: TreatmentPlanDiscountType;
  discountValue: number;
  discountComment?: string | null;
  /** Complete ordered snapshot. Array order becomes the server sort order. */
  items: UpdateTreatmentPlanItemRequest[];
}

export interface EligibleTreatmentPlanPatientDto {
  id: string;
  fullName: string;
  phone: string | null;
}

export interface EligibleTreatmentPlanPatientPageDto {
  content: EligibleTreatmentPlanPatientDto[];
  page: number;
  size: number;
  hasNext: boolean;
}

export class TreatmentPlanApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TreatmentPlanApiError";
  }
}

const STATUSES = new Set<TreatmentPlanStatus>([
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

const DISCOUNT_TYPES = new Set<TreatmentPlanDiscountType>(["PERCENT", "FIXED"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TreatmentPlanApiError(`Invalid ${field}`, 502);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new TreatmentPlanApiError(`Invalid ${field}`, 502);
  }
  return value;
}

function numeric(value: unknown, field: string): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    throw new TreatmentPlanApiError(`Invalid ${field}`, 502);
  }
  return parsed;
}

function nullableInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  const parsed = numeric(value, field);
  if (!Number.isInteger(parsed)) {
    throw new TreatmentPlanApiError(`Invalid ${field}`, 502);
  }
  return parsed;
}

function status(value: unknown, field: string): TreatmentPlanStatus {
  if (typeof value !== "string") {
    throw new TreatmentPlanApiError(`Invalid ${field}`, 502);
  }
  const normalized = value.toUpperCase() as TreatmentPlanStatus;
  if (!STATUSES.has(normalized)) {
    throw new TreatmentPlanApiError(`Invalid ${field}`, 502);
  }
  return normalized;
}

function discountType(value: unknown, field: string): TreatmentPlanDiscountType {
  if (typeof value !== "string") {
    throw new TreatmentPlanApiError(`Invalid ${field}`, 502);
  }
  const normalized = value.toUpperCase() as TreatmentPlanDiscountType;
  if (!DISCOUNT_TYPES.has(normalized)) {
    throw new TreatmentPlanApiError(`Invalid ${field}`, 502);
  }
  return normalized;
}

function parseItem(value: unknown, index: number): TreatmentPlanItemDto {
  if (!isRecord(value)) {
    throw new TreatmentPlanApiError(`Invalid items[${index}]`, 502);
  }
  return {
    id: requiredString(value.id, `items[${index}].id`),
    serviceId: nullableString(value.serviceId, `items[${index}].serviceId`),
    toothNumber: nullableInteger(value.toothNumber, `items[${index}].toothNumber`),
    description: requiredString(value.description, `items[${index}].description`),
    quantity: numeric(value.quantity, `items[${index}].quantity`),
    unitPrice: numeric(value.unitPrice, `items[${index}].unitPrice`),
    totalPrice: numeric(value.totalPrice, `items[${index}].totalPrice`),
    status: status(value.status, `items[${index}].status`),
    stageName: nullableString(value.stageName, `items[${index}].stageName`),
    notes: nullableString(value.notes, `items[${index}].notes`),
  };
}

function parsePlan(value: unknown, index = 0): TreatmentPlanDto {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new TreatmentPlanApiError(`Invalid treatment plan[${index}]`, 502);
  }
  return {
    id: requiredString(value.id, `plans[${index}].id`),
    patientId: requiredString(value.patientId, `plans[${index}].patientId`),
    doctorName: requiredString(value.doctorName, `plans[${index}].doctorName`),
    clinicName: requiredString(value.clinicName, `plans[${index}].clinicName`),
    title: requiredString(value.title, `plans[${index}].title`),
    description: nullableString(value.description, `plans[${index}].description`),
    status: status(value.status, `plans[${index}].status`),
    totalCost: numeric(value.totalCost, `plans[${index}].totalCost`),
    discountType: discountType(value.discountType, `plans[${index}].discountType`),
    discountValue: numeric(value.discountValue, `plans[${index}].discountValue`),
    discountAmount: numeric(value.discountAmount, `plans[${index}].discountAmount`),
    discountComment: nullableString(
      value.discountComment,
      `plans[${index}].discountComment`,
    ),
    patientConsentConfirmedAt: nullableString(
      value.patientConsentConfirmedAt,
      `plans[${index}].patientConsentConfirmedAt`,
    ),
    currency: requiredString(value.currency, `plans[${index}].currency`).toUpperCase(),
    items: value.items.map(parseItem),
    createdAt: requiredString(value.createdAt, `plans[${index}].createdAt`),
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TreatmentPlanApiError("Invalid server response", response.status || 502);
  }
}

function responseErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    const message = body.message ?? body.error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function authenticatedRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const session = await supabase.auth.getSession();
  const firstToken = session.data.session?.access_token;
  if (!firstToken) throw new TreatmentPlanApiError("AUTH_REQUIRED", 401);

  const send = (token: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      credentials: "omit",
      cache: "no-store",
    });

  let response = await send(firstToken);
  if (response.status === 401) {
    await supabase.auth.getUser();
    const refreshed = await supabase.auth.getSession();
    const refreshedToken = refreshed.data.session?.access_token;
    if (refreshedToken && refreshedToken !== firstToken) {
      response = await send(refreshedToken);
    }
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new TreatmentPlanApiError(
      responseErrorMessage(body, `HTTP ${response.status}`),
      response.status,
    );
  }
  return body;
}

export async function getPatientTreatmentPlans(
  patientId: string,
  signal?: AbortSignal,
): Promise<TreatmentPlanDto[]> {
  const body = await authenticatedRequest(
    `/patient/${encodeURIComponent(patientId)}`,
    { signal },
  );
  if (!Array.isArray(body)) {
    throw new TreatmentPlanApiError("Invalid treatment plan list", 502);
  }
  return body.map(parsePlan);
}

export async function getEligibleTreatmentPlanPatients(options: {
  clinicId: string;
  search?: string;
  page?: number;
  size?: number;
  signal?: AbortSignal;
}): Promise<EligibleTreatmentPlanPatientPageDto> {
  const page = options.page ?? 0;
  const size = options.size ?? 20;
  const params = new URLSearchParams({
    clinicId: options.clinicId,
    page: String(page),
    size: String(size),
  });
  const search = options.search?.trim();
  if (search) params.set("search", search);

  const body = await authenticatedRequest(
    `/eligible-patients?${params.toString()}`,
    { signal: options.signal },
  );
  if (!isRecord(body) || !Array.isArray(body.content)) {
    throw new TreatmentPlanApiError("Invalid eligible patient page", 502);
  }
  const parsedPage = numeric(body.page, "eligiblePatients.page");
  const parsedSize = numeric(body.size, "eligiblePatients.size");
  if (!Number.isInteger(parsedPage) || !Number.isInteger(parsedSize)
      || typeof body.hasNext !== "boolean") {
    throw new TreatmentPlanApiError("Invalid eligible patient pagination", 502);
  }

  return {
    content: body.content.map((value, index) => {
      if (!isRecord(value)) {
        throw new TreatmentPlanApiError(`Invalid eligiblePatients[${index}]`, 502);
      }
      return {
        id: requiredString(value.id, `eligiblePatients[${index}].id`),
        fullName: requiredString(value.fullName, `eligiblePatients[${index}].fullName`),
        phone: nullableString(value.phone, `eligiblePatients[${index}].phone`),
      };
    }),
    page: parsedPage,
    size: parsedSize,
    hasNext: body.hasNext,
  };
}

interface RawPlanRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  status: string;
  total_cost: number | string | null;
  discount_type: string;
  discount_value: number | string;
  discount_amount: number | string;
  discount_comment: string | null;
  patient_consent_confirmed_at: string | null;
  currency: string | null;
  created_at: string;
}

interface RawItemRow {
  id: string;
  treatment_plan_id: string;
  service_id: string | null;
  tooth_number: number | null;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  total_price: number | string;
  status: string;
  sort_order: number | null;
  stage_name: string | null;
  notes: string | null;
}

interface RawDoctorRow {
  id: string;
  profiles?: { full_name?: string | null } | null;
}

function scopedDataError(message: string, statusCode?: number): TreatmentPlanApiError {
  return new TreatmentPlanApiError(message || "Treatment plan data error", statusCode || 500);
}

/**
 * Clinic staff do not satisfy the dedicated doctor's GET authorization rule.
 * The existing /data shim has server-enforced clinic scope, so this read keeps
 * both patient_id and clinic_id filters mandatory and maps only current columns.
 */
export async function getClinicPatientTreatmentPlans(
  patientId: string,
  clinicId: string,
): Promise<TreatmentPlanDto[]> {
  if (!patientId || !clinicId) {
    throw new TreatmentPlanApiError("Patient and clinic are required", 400);
  }

  const plansResult = await supabase
    .from("treatment_plans")
    .select(
      "id,patient_id,doctor_id,clinic_id,title,description,status,total_cost,discount_type,discount_value,discount_amount,discount_comment,patient_consent_confirmed_at,currency,created_at",
    )
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (plansResult.error) {
    throw scopedDataError(plansResult.error.message, plansResult.status);
  }
  const planRows = (plansResult.data || []) as RawPlanRow[];
  if (planRows.length === 0) return [];

  const planIds = planRows.map((plan) => plan.id);
  const doctorIds = [...new Set(planRows.map((plan) => plan.doctor_id))];
  const [itemsResult, doctorsResult, clinicResult] = await Promise.all([
    supabase
      .from("treatment_plan_items")
      .select(
        "id,treatment_plan_id,service_id,tooth_number,description,quantity,unit_price,total_price,status,sort_order,stage_name,notes",
      )
      .in("treatment_plan_id", planIds)
      .order("sort_order", { ascending: true }),
    supabase
      .from("doctors")
      .select("id,profiles:user_id(full_name)")
      .in("id", doctorIds),
    supabase.from("clinics").select("id,name").eq("id", clinicId).maybeSingle(),
  ]);

  if (itemsResult.error) {
    throw scopedDataError(itemsResult.error.message, itemsResult.status);
  }

  const doctorNames = new Map<string, string>();
  if (!doctorsResult.error) {
    for (const doctor of (doctorsResult.data || []) as RawDoctorRow[]) {
      const name = doctor.profiles?.full_name?.trim();
      if (name) doctorNames.set(doctor.id, name);
    }
  }
  const clinicName =
    !clinicResult.error && typeof clinicResult.data?.name === "string"
      ? clinicResult.data.name
      : "—";

  const itemsByPlan = new Map<string, TreatmentPlanItemDto[]>();
  for (const raw of (itemsResult.data || []) as RawItemRow[]) {
    const item = parseItem(
      {
        id: raw.id,
        serviceId: raw.service_id,
        toothNumber: raw.tooth_number,
        description: raw.description,
        quantity: raw.quantity,
        unitPrice: raw.unit_price,
        totalPrice: raw.total_price,
        status: raw.status,
        stageName: raw.stage_name,
        notes: raw.notes,
      },
      itemsByPlan.get(raw.treatment_plan_id)?.length || 0,
    );
    const current = itemsByPlan.get(raw.treatment_plan_id) || [];
    current.push(item);
    itemsByPlan.set(raw.treatment_plan_id, current);
  }

  return planRows.map((raw, index) => {
    const items = itemsByPlan.get(raw.id) || [];
    const fallbackTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    return parsePlan(
      {
        id: raw.id,
        patientId: raw.patient_id,
        doctorName: doctorNames.get(raw.doctor_id) || "—",
        clinicName,
        title: raw.title,
        description: raw.description,
        status: raw.status,
        totalCost: raw.total_cost ?? fallbackTotal,
        discountType: raw.discount_type,
        discountValue: raw.discount_value,
        discountAmount: raw.discount_amount,
        discountComment: raw.discount_comment,
        patientConsentConfirmedAt: raw.patient_consent_confirmed_at,
        currency: raw.currency || "UZS",
        items,
        createdAt: raw.created_at,
      },
      index,
    );
  });
}

export async function createTreatmentPlan(
  request: CreateTreatmentPlanRequest,
): Promise<TreatmentPlanDto> {
  const body = await authenticatedRequest("", {
    method: "POST",
    body: JSON.stringify(request),
  });
  return parsePlan(body);
}

export async function updateTreatmentPlan(
  planId: string,
  request: UpdateTreatmentPlanRequest,
): Promise<TreatmentPlanDto> {
  const body = await authenticatedRequest(`/${encodeURIComponent(planId)}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
  return parsePlan(body);
}

export async function updateTreatmentPlanStatus(
  planId: string,
  nextStatus: TreatmentPlanStatus,
): Promise<TreatmentPlanDto> {
  const body = await authenticatedRequest(
    `/${encodeURIComponent(planId)}/status?status=${encodeURIComponent(nextStatus)}`,
    { method: "PUT" },
  );
  return parsePlan(body);
}
