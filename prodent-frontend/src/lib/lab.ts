// Client for the secure dental-lab API (/api/v1/lab).
// The lab domain (orders / events / materials / messages) left the generic data
// proxy: the LabController scopes every read+write — a technician sees only
// their own orders, a clinic only its clinic's, admin everything. Order status
// moves ONLY via the workflow endpoints (accept / decline / advance / cancel),
// never by patching `status` directly.

const API_BASE = "/api/v1/lab";
const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

function doFetch(path: string, opts: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

async function tryRefresh(): Promise<boolean> {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) return false;
  try {
    const r = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return false;
    const b = (await r.json()) as {
      access_token?: string;
      token?: string;
      refresh_token?: string;
      data?: { access_token?: string; refresh_token?: string };
    };
    const at = b.access_token ?? b.token ?? b.data?.access_token;
    if (!at) return false;
    localStorage.setItem(TOKEN_KEY, at);
    const newRt = b.refresh_token ?? b.data?.refresh_token;
    if (newRt) localStorage.setItem(REFRESH_KEY, newRt);
    return true;
  } catch {
    return false;
  }
}

async function req<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  let res = await doFetch(path, opts);
  if (res.status === 401 && (await tryRefresh())) {
    res = await doFetch(path, opts);
  }
  const text = await res.text();
  const data = (text ? JSON.parse(text) : null) as { error?: string; message?: string } | null;
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
  }
  return data as T;
}

const qs = <T extends object>(f: T): string => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (typeof v === "string" && v !== "") p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Types ────────────────────────────────────────────────────────────────────

// new → (accept) → queued → model → wax → milling → frame → glaze → ready →
// delivered. new → (decline) → declined. Any non-terminal → cancelled.
export type LabOrderStatus =
  | "new"
  | "queued"
  | "model"
  | "wax"
  | "milling"
  | "frame"
  | "glaze"
  | "ready"
  | "delivered"
  | "cancelled"
  | "declined";

export interface LabOrder {
  id: string;
  order_number: number | null;
  clinic_id: string | null;
  doctor_id: string | null;
  technician_id: string | null;
  created_by: string | null;
  patient_name: string | null;
  work_type: string;
  material: string | null;
  tooth: string | null;
  shade: string | null;
  status: LabOrderStatus;
  priority: "normal" | "urgent";
  due_date: string | null;
  price: number | null;
  currency: string;
  notes: string | null;
  accepted_at: string | null;
  declined_reason: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  medical_record_id?: string | null;
  medical_visit_id?: string | null;
  treatment_plan_id?: string | null;
  treatment_plan_item_id?: string | null;
  patient_id?: string | null;
  due_at?: string | null;
  // Joined display names (server-side LEFT JOINs).
  clinic_name: string | null;
  technician_name: string | null;
  doctor_name: string | null;
  // Unregistered customer (technician self-orders) — free-text.
  external_customer_name: string | null;
  external_customer_phone: string | null;
  external_customer_clinic: string | null;
}

// A registered customer (doctor or clinic) returned by the /customers search.
export interface LabCustomer {
  type: "doctor" | "clinic";
  id: string;
  name: string | null;
  phone: string | null;
}

export interface LabOrderEvent {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  actor_user_id: string | null;
  actor_role: string | null;
  note: string | null;
  created_at: string;
}

export type LabOrderWithEvents = LabOrder & { events: LabOrderEvent[] };

export interface LabMessage {
  id: string;
  order_id: string;
  sender_user_id: string | null;
  sender_role: string | null;
  body: string;
  created_at: string;
}

export interface LabOrderFile {
  id: string;
  order_id: string;
  file_name: string;
  storage_key: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by?: string | null;
  created_at?: string;
}

export interface LabClarification {
  id: string;
  order_id: string;
  requested_by: string;
  message: string;
  proposed_due_at: string | null;
  proposed_price: number | null;
  proposed_currency: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  resolved_by: string | null;
  resolution_message: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface LabMaterial {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  stock_qty: number;
  min_qty: number;
  unit_cost: number | null;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabStats {
  incoming: number;
  queued: number;
  in_work: number;
  due_today: number;
  done30: number;
}

export interface LabSettlement {
  id: string;
  order_id: string;
  entry_type: "PAYMENT" | "REFUND" | "ADJUSTMENT";
  amount: number;
  currency: string;
  method: string | null;
  note: string | null;
  created_at: string;
}

export interface LabDispute {
  id: string;
  order_id: string;
  reason: string;
  status: "OPEN" | "ACCEPTED" | "REJECTED";
  resolution?: string | null;
  created_at: string;
}

export interface LabMaterialEvent {
  id: string;
  material_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  created_at: string;
}

export interface LabTechnician {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  description: string | null;
  verified_at: string | null;
  service_count: number;
  is_favorite?: boolean;
}

export interface LabProfile {
  user_id: string;
  display_name: string | null;
  description: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  avatar_url: string | null;
  is_public: boolean;
  verified_at: string | null;
  user_full_name: string | null;
  email: string | null;
}

export interface LabServiceItem {
  id: string;
  technician_user_id?: string;
  work_type: string;
  price: number | null;
  unit: string;
  is_active?: boolean;
}

export interface LabOrderMaterial {
  id: string;
  order_id: string;
  material_id: string;
  material_name: string | null;
  material_unit: string | null;
  qty: number;
  unit_cost: number | null;
  total_cost: number | null;
  created_at: string;
}

export interface LabClinicRevenue {
  clinic_id: string | null;
  clinic_name: string;
  orders: number;
  paid_revenue: number;
  receivable_revenue: number;
  unpaid_count: number;
  materials_cost: number;
}

export interface OrderFilters {
  status?: string;
  q?: string;
  limit?: string;
  created_before?: string;
  before_id?: string;
}

export interface CreateLabOrderInput {
  client_request_id: string;
  technician_id?: string;
  work_type: string;
  medical_record_id?: string;
  treatment_plan_id?: string;
  treatment_plan_item_id?: string;
  patient_id?: string;
  patient_name?: string | null;
  due_at?: string | null;
  due_date?: string | null;
  material?: string | null;
  tooth?: string | null;
  shade?: string | null;
  priority?: "normal" | "urgent" | string;
  price?: number | null;
  currency?: string;
  notes?: string | null;
  doctor_id?: string;
  clinic_id?: string;
  external_customer_name?: string;
  external_customer_phone?: string;
  external_customer_clinic?: string;
}

// ── API ──────────────────────────────────────────────────────────────────────

export const lab = {
  // Orders
  listOrders: (f: OrderFilters = {}) => req<LabOrder[]>(`/orders${qs(f)}`),
  getOrder: (id: string) => req<LabOrderWithEvents>(`/orders/${id}`),
  createOrder: (body: CreateLabOrderInput) =>
    req<LabOrder>("/orders", { method: "POST", body: JSON.stringify(body) }),

  // Workflow transitions
  acceptOrder: (id: string) => req<LabOrder>(`/orders/${id}/accept`, { method: "POST" }),
  declineOrder: (id: string, reason?: string) =>
    req<LabOrder>(`/orders/${id}/decline`, { method: "POST", body: JSON.stringify({ reason }) }),
  advanceOrder: (id: string, to?: string, note?: string) =>
    req<LabOrder>(`/orders/${id}/advance`, { method: "POST", body: JSON.stringify({ to, note }) }),
  receiveOrder: (id: string, note?: string) =>
    req<LabOrder>(`/orders/${id}/receive`, { method: "POST", body: JSON.stringify({ note }) }),
  cancelOrder: (id: string, reason?: string) =>
    req<LabOrder>(`/orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  listSettlements: (id: string) =>
    req<LabSettlement[]>(`/orders/${id}/settlements`),
  createSettlement: (
    id: string,
    body: {
      entry_type: "PAYMENT" | "REFUND" | "ADJUSTMENT";
      amount: number;
      currency: string;
      method: string;
      note?: string;
      client_request_id: string;
    },
  ) =>
    req<LabSettlement>(`/orders/${id}/settlements`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  openDispute: (id: string, reason: string) =>
    req<LabDispute>(`/orders/${id}/disputes`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  listDisputes: (status?: string, limit = "100") =>
    req<LabDispute[]>(`/disputes${qs({ status, limit })}`),
  resolveDispute: (id: string, accepted: boolean, resolution: string) =>
    req<LabDispute>(`/disputes/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ accepted, resolution }),
    }),

  // Per-order material consumption
  listOrderMaterials: (id: string) => req<LabOrderMaterial[]>(`/orders/${id}/materials`),
  consumeMaterial: (id: string, materialId: string, qty: number) =>
    req<LabOrderMaterial>(`/orders/${id}/materials`, {
      method: "POST",
      body: JSON.stringify({ material_id: materialId, qty }),
    }),
  undoConsumeMaterial: (id: string, consumptionId: string) =>
    req(`/orders/${id}/materials/${consumptionId}`, { method: "DELETE" }),

  // Finance
  clinicRevenue: () => req<LabClinicRevenue[]>("/finance/clinics"),

  // Messages
  listMessages: (orderId: string) => req<LabMessage[]>(`/orders/${orderId}/messages`),
  sendMessage: (orderId: string, body: string, runtime?: { online?: boolean }) => {
    if (runtime?.online === false) return Promise.reject(new Error("offline"));
    return req<LabMessage>(`/orders/${orderId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },
  sendClarification: async (
    orderId: string,
    body: string,
    runtime?: { online?: boolean },
  ) => {
    const { normalizeClarification } = await import("./lab-workflow");
    return lab.sendMessage(orderId, normalizeClarification(body), runtime);
  },

  // A due-date/price proposal is an explicit request. The server never changes
  // the agreed values silently; the customer accepts or rejects the request.
  listClarifications: (orderId: string) =>
    req<LabClarification[]>(`/orders/${orderId}/clarifications`),
  createClarification: async (
    orderId: string,
    body: { message: string; due_at?: string; price?: number; currency?: string },
  ) => {
    const { normalizeClarification } = await import("./lab-workflow");
    if (!body.due_at && body.price == null) {
      throw new Error("clarification_change_required");
    }
    return req<LabClarification>(`/orders/${orderId}/clarifications`, {
      method: "POST",
      body: JSON.stringify({ ...body, message: normalizeClarification(body.message) }),
    });
  },
  resolveClarification: (
    orderId: string,
    clarificationId: string,
    body: { accepted: boolean; message?: string },
  ) =>
    req<LabClarification>(
      `/orders/${orderId}/clarifications/${clarificationId}/resolve`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  // File bytes are stored privately first. This endpoint registers only the
  // server-authorized metadata against an order visible to the caller.
  listOrderFiles: (orderId: string) =>
    req<LabOrderFile[]>(`/orders/${orderId}/files`),
  registerOrderFile: (
    orderId: string,
    body: {
      file_name: string;
      storage_key: string;
      content_type: string;
      size_bytes: number;
    },
  ) =>
    req<LabOrderFile>(`/orders/${orderId}/files`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteOrderFile: (orderId: string, fileId: string) =>
    req(`/orders/${orderId}/files/${fileId}`, { method: "DELETE" }),

  // Materials (technician-internal stock)
  listMaterials: () => req<LabMaterial[]>("/materials"),
  createMaterial: (body: Record<string, unknown>) =>
    req<LabMaterial>("/materials", { method: "POST", body: JSON.stringify(body) }),
  updateMaterial: (id: string, body: Record<string, unknown>) =>
    req<LabMaterial>(`/materials/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteMaterial: (id: string) => req(`/materials/${id}`, { method: "DELETE" }),
  adjustMaterial: (
    id: string,
    body: { delta: number; reason: string; client_request_id: string },
  ) =>
    req<LabMaterial>(`/materials/${id}/delta`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listMaterialEvents: (id: string) =>
    req<LabMaterialEvent[]>(`/materials/${id}/events`),

  // Technician catalog (clinic-side picker)
  listTechnicians: (q?: string) => req<LabTechnician[]>(`/technicians${qs({ q })}`),
  technicianServices: (id: string) => req<LabServiceItem[]>(`/technicians/${id}/services`),

  // Customer directory (registered doctors + clinics) for a technician's self-order.
  searchCustomers: (q?: string) => req<LabCustomer[]>(`/customers${qs({ q })}`),

  // Favorites — the clinic/doctor's own "Мои лаборатории" list.
  addFavorite: (id: string) => req(`/technicians/${id}/favorite`, { method: "POST" }),
  removeFavorite: (id: string) => req(`/technicians/${id}/favorite`, { method: "DELETE" }),

  // Technician's own profile + price-list
  getProfile: () => req<LabProfile>("/profile"),
  updateProfile: (body: Record<string, unknown>) =>
    req<LabProfile>("/profile", { method: "PATCH", body: JSON.stringify(body) }),
  listServices: () => req<LabServiceItem[]>("/services"),
  createService: (body: Record<string, unknown>) =>
    req<LabServiceItem>("/services", { method: "POST", body: JSON.stringify(body) }),
  updateService: (id: string, body: Record<string, unknown>) =>
    req<LabServiceItem>(`/services/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteService: (id: string) => req(`/services/${id}`, { method: "DELETE" }),

  // Stats (sidebar counters)
  stats: () => req<LabStats>("/stats"),
};
