// Client for the secure marketplace API (/api/v1/marketplace).
// Catalog READS use the public Supabase-style proxy (`supabase.from(...)`);
// all WRITES and ORDERS go through this controller, which enforces role +
// ownership checks server-side.

const API_BASE = "/api/v1/marketplace";
const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function nestedRecord(value: UnknownRecord | null, key: string): UnknownRecord | null {
  const nested = value?.[key];
  return isRecord(nested) ? nested : null;
}

function responseError(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  return stringValue(value.error) ?? stringValue(value.message) ?? fallback;
}

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

// Short-lived access tokens expire; mirror the Supabase shim and silently
// refresh once on 401 so a seller mid-session doesn't hit "Unauthorized".
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
    const raw: unknown = await r.json();
    const body = isRecord(raw) ? raw : null;
    const nested = nestedRecord(body, "data");
    const at = stringValue(body?.access_token) ?? stringValue(body?.token) ?? stringValue(nested?.access_token);
    if (!at) return false;
    localStorage.setItem(TOKEN_KEY, at);
    const newRt = stringValue(body?.refresh_token) ?? stringValue(nested?.refresh_token);
    if (newRt) localStorage.setItem(REFRESH_KEY, newRt);
    return true;
  } catch {
    return false;
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  let res = await doFetch(path, opts);
  if (res.status === 401 && (await tryRefresh())) {
    res = await doFetch(path, opts); // retry once with the refreshed token
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(responseError(data, `HTTP ${res.status}`));
  }
  return data as T;
}

export interface MarketplaceSupplier {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  inn: string | null;
  delivery_terms: string | null;
  payment_terms: string | null;
  warehouse_address: string | null;
  rating: number;
  reviews_count: number;
  is_verified: boolean;
  is_active: boolean;
  moderation_status?: "pending" | "approved" | "rejected";
  moderation_reason?: string | null;
  moderation_reviewed_at?: string | null;
}

export type MarketplaceOrderStatus =
  | "new"
  | "accepted"
  | "awaiting_payment"
  | "preparing"
  | "shipped"
  | "received"
  | "completed"
  | "cancelled";

export interface MarketplaceOrderEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_role: string | null;
  reason: string | null;
  created_at: string;
}

export interface MarketplaceOrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  name: string;
  unit: string | null;
  price: number;
  quantity: number;
  line_total: number;
}

export interface MarketplaceOrder {
  id: string;
  order_number: number;
  buyer_user_id: string;
  supplier_id: string;
  supplier_name?: string | null;
  status: MarketplaceOrderStatus;
  total_amount: number;
  currency: string;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_address: string | null;
  note: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  paid_at?: string | null;
  reservation_status?: "none" | "active" | "consumed" | "released";
  payments?: MarketplacePayment[];
  refunds?: MarketplaceRefund[];
  disputes?: MarketplaceDispute[];
  reservations?: MarketplaceReservation[];
  stock_events?: MarketplaceStockEvent[];
  created_at: string;
  items?: MarketplaceOrderItem[];
  events?: MarketplaceOrderEvent[];
}

export interface MarketplacePayment {
  id: string;
  order_id: string;
  provider: string;
  provider_reference: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "partially_refunded" | "refunded";
  paid_at?: string | null;
  created_at?: string;
}

export interface MarketplaceDisputeEvent {
  id: string;
  event_type: string;
  reason: string;
  created_at: string;
}

export interface MarketplaceRefund {
  id: string;
  amount: number;
  status: "pending" | "completed" | "failed";
  reason: string;
  created_at: string;
}

export interface MarketplaceReservation {
  id: string;
  order_id: string;
  order_item_id: string;
  product_id: string;
  quantity: number;
  status: "active" | "consumed" | "released" | "expired";
  created_at: string;
  expires_at: string;
  consumed_at?: string | null;
  released_at?: string | null;
}

export interface MarketplaceStockEvent {
  id: string;
  order_id?: string | null;
  product_id: string;
  supplier_id: string;
  type: "income" | "writeoff" | "adjustment";
  quantity: number;
  reason?: string | null;
  balance_after: number;
  created_at: string;
}

export interface MarketplaceDispute {
  id: string;
  order_id?: string;
  order_number?: number;
  reason: string;
  status: "open" | "resolved_refund" | "resolved_reject";
  resolution_reason?: string | null;
  opened_at: string;
  resolved_at?: string | null;
  order_status?: string;
  payment_status?: string;
  total_amount?: number;
  currency?: string;
  supplier_name?: string | null;
  order?: MarketplaceOrder;
  events?: MarketplaceDisputeEvent[];
}

export interface MarketplaceCatalogProduct {
  id: string;
  supplier_id: string;
  type: "product" | "service";
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  unit: string | null;
  price: number;
  currency: string;
  stock_quantity: number | null;
  image_url: string | null;
  supplier_name?: string | null;
  supplier_city?: string | null;
  supplier_verified?: boolean;
}

export interface MarketplaceCatalogPage {
  items: MarketplaceCatalogProduct[];
  page: number;
  size: number;
  has_more: boolean;
}

export interface MarketplaceCatalogQuery {
  page?: number;
  size?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc";
}

export interface MarketplaceReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_user_id: string;
  buyer_name: string;
  moderation_status?: "pending" | "approved" | "rejected";
  moderation_reason?: string | null;
}

export interface SupplierReviewsResponse {
  reviews: MarketplaceReview[];
  my: MarketplaceReview | null;
  can_review: boolean;
}

export interface SupplierUpdateInput {
  name: string;
  description?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  inn?: string | null;
  delivery_terms?: string | null;
  payment_terms?: string | null;
  warehouse_address?: string | null;
}

export interface MarketplaceStockTransaction {
  id: string;
  product_name: string;
  type: "income" | "writeoff" | "adjustment";
  quantity: number;
  reason: string | null;
  balance_after: number;
  created_at: string;
}

export interface SellerDashboardStatusCounts {
  new: number;
  accepted: number;
  awaiting_payment: number;
  preparing: number;
  shipped: number;
  received: number;
  completed: number;
  cancelled: number;
}

export interface SellerDailyRevenue {
  date: string;
  revenue: number;
}

export interface SellerTopProduct {
  product_id: string | null;
  name: string;
  sku: string | null;
  units_sold: number;
  revenue: number;
}

export interface SellerDashboard {
  has_storefront: boolean;
  supplier_id: string | null;
  currency: "UZS";
  revenue_total: number;
  revenue_30_days: number;
  revenue_7_days: number;
  order_count: number;
  completed_order_count: number;
  cancelled_order_count: number;
  returned_order_count: number;
  returns_supported: boolean;
  average_order: number;
  status_counts: SellerDashboardStatusCounts;
  active_product_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  review_count: number;
  average_rating: number;
  daily_revenue_7_days: SellerDailyRevenue[];
  top_products: SellerTopProduct[];
}

const STATUS_KEYS: Array<keyof SellerDashboardStatusCounts> = [
  "new",
  "accepted",
  "awaiting_payment",
  "preparing",
  "shipped",
  "received",
  "completed",
  "cancelled",
];

export function emptySellerDashboard(): SellerDashboard {
  return {
    has_storefront: false,
    supplier_id: null,
    currency: "UZS",
    revenue_total: 0,
    revenue_30_days: 0,
    revenue_7_days: 0,
    order_count: 0,
    completed_order_count: 0,
    cancelled_order_count: 0,
    returned_order_count: 0,
    returns_supported: false,
    average_order: 0,
    status_counts: {
      new: 0,
      accepted: 0,
      awaiting_payment: 0,
      preparing: 0,
      shipped: 0,
      received: 0,
      completed: 0,
      cancelled: 0,
    },
    active_product_count: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    review_count: 0,
    average_rating: 0,
    daily_revenue_7_days: [],
    top_products: [],
  };
}

export function normalizeSellerDashboard(value: unknown): SellerDashboard {
  if (!isRecord(value)) return emptySellerDashboard();
  const statusRaw = isRecord(value.status_counts) ? value.status_counts : {};
  const statusCounts = emptySellerDashboard().status_counts;
  for (const key of STATUS_KEYS) statusCounts[key] = numberValue(statusRaw[key]);

  const dailyRevenue = Array.isArray(value.daily_revenue_7_days)
    ? value.daily_revenue_7_days.flatMap((row): SellerDailyRevenue[] => {
        if (!isRecord(row) || typeof row.date !== "string") return [];
        return [{ date: row.date, revenue: numberValue(row.revenue) }];
      })
    : [];
  const topProducts = Array.isArray(value.top_products)
    ? value.top_products.flatMap((row): SellerTopProduct[] => {
        if (!isRecord(row) || typeof row.name !== "string") return [];
        return [{
          product_id: stringValue(row.product_id) ?? null,
          name: row.name,
          sku: stringValue(row.sku) ?? null,
          units_sold: numberValue(row.units_sold),
          revenue: numberValue(row.revenue),
        }];
      })
    : [];

  return {
    has_storefront: booleanValue(value.has_storefront),
    supplier_id: stringValue(value.supplier_id) ?? null,
    currency: "UZS",
    revenue_total: numberValue(value.revenue_total),
    revenue_30_days: numberValue(value.revenue_30_days),
    revenue_7_days: numberValue(value.revenue_7_days),
    order_count: numberValue(value.order_count),
    completed_order_count: numberValue(value.completed_order_count),
    cancelled_order_count: numberValue(value.cancelled_order_count),
    returned_order_count: numberValue(value.returned_order_count),
    returns_supported: booleanValue(value.returns_supported),
    average_order: numberValue(value.average_order),
    status_counts: statusCounts,
    active_product_count: numberValue(value.active_product_count),
    low_stock_count: numberValue(value.low_stock_count),
    out_of_stock_count: numberValue(value.out_of_stock_count),
    review_count: numberValue(value.review_count),
    average_rating: numberValue(value.average_rating),
    daily_revenue_7_days: dailyRevenue,
    top_products: topProducts,
  };
}

export function hasSellerDashboardActivity(dashboard: SellerDashboard): boolean {
  return dashboard.order_count > 0
    || dashboard.active_product_count > 0
    || dashboard.review_count > 0
    || dashboard.daily_revenue_7_days.some((day) => day.revenue > 0)
    || dashboard.top_products.length > 0;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function sellerDashboardToCsv(dashboard: SellerDashboard): string {
  const rows: Array<Array<string | number>> = [
    ["Метрика", "Значение"],
    ["Выручка за всё время", `${dashboard.revenue_total} ${dashboard.currency}`],
    ["Выручка за 30 дней", `${dashboard.revenue_30_days} ${dashboard.currency}`],
    ["Выручка за 7 дней", `${dashboard.revenue_7_days} ${dashboard.currency}`],
    ["Заказы", dashboard.order_count],
    ["Завершённые заказы", dashboard.completed_order_count],
    ["Отменённые заказы", dashboard.cancelled_order_count],
    ["Средний заказ", `${dashboard.average_order} ${dashboard.currency}`],
    ["Активные товары", dashboard.active_product_count],
    ["Товары с низким остатком", dashboard.low_stock_count],
    ["Товары без остатка", dashboard.out_of_stock_count],
    ["Отзывы", dashboard.review_count],
    ["Средняя оценка", dashboard.average_rating],
    [],
    ["Дата", "Выручка"],
    ...dashboard.daily_revenue_7_days.map((day) => [day.date, `${day.revenue} ${dashboard.currency}`]),
    [],
    ["Товар", "SKU", "Продано", "Выручка"],
    ...dashboard.top_products.map((product) => [
      product.name,
      product.sku ?? "",
      product.units_sold,
      `${product.revenue} ${dashboard.currency}`,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface PlaceOrderInput {
  supplier_id: string;
  items: OrderItemInput[];
  client_request_id: string;
  contact_name?: string;
  contact_phone?: string;
  delivery_address?: string;
  note?: string;
  buyer_clinic_id?: string;
}

export const marketplace = {
  listCatalog: (query: MarketplaceCatalogQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page != null) params.set("page", String(query.page));
    if (query.size != null) params.set("size", String(query.size));
    if (query.search) params.set("search", query.search);
    if (query.category) params.set("category", query.category);
    if (query.minPrice != null) params.set("minPrice", String(query.minPrice));
    if (query.maxPrice != null) params.set("maxPrice", String(query.maxPrice));
    if (query.sort) params.set("sort", query.sort);
    return req<MarketplaceCatalogPage>(`/catalog${params.size ? `?${params.toString()}` : ""}`);
  },
  getDashboard: async () => normalizeSellerDashboard(await req<unknown>("/dashboard")),
  getMySupplier: () => req<MarketplaceSupplier | null>("/my-supplier"),
  upsertSupplier: (body: SupplierUpdateInput) =>
    req<MarketplaceSupplier>("/my-supplier", { method: "POST", body: JSON.stringify(body) }),

  createProduct: (body: Record<string, unknown>) =>
    req<UnknownRecord>("/products", { method: "POST", body: JSON.stringify(body) }),
  listMyProducts: () => req<UnknownRecord[]>("/my-products"),
  updateProduct: (id: string, body: Record<string, unknown>) =>
    req<UnknownRecord>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id: string) => req<{ ok: boolean }>(`/products/${id}`, { method: "DELETE" }),

  // Product detail for the market product page (product + supplier + demand stats).
  getProduct: (id: string) => req<UnknownRecord>(`/products/${id}`),

  // Warehouse / stock
  adjustStock: (id: string, body: { type: "income" | "writeoff" | "adjustment"; quantity: number; reason?: string }) =>
    req<UnknownRecord>(`/products/${id}/stock`, { method: "POST", body: JSON.stringify(body) }),
  listStockTransactions: () => req<MarketplaceStockTransaction[]>("/stock/transactions"),

  placeOrder: (body: PlaceOrderInput) =>
    req<MarketplaceOrder>("/orders", { method: "POST", body: JSON.stringify(body) }),
  listOrders: (role?: "buyer" | "supplier") =>
    req<MarketplaceOrder[]>(`/orders${role ? `?role=${role}` : ""}`),
  // Platform-admin: list ALL orders (optional status filter). ADMIN/SUPER_ADMIN only.
  adminListOrders: (status?: string) =>
    req<MarketplaceOrder[]>(`/admin/orders${status && status !== "all" ? `?status=${status}` : ""}`),
  // Platform-admin: storefront verification / deactivation. ADMIN/SUPER_ADMIN only.
  adminListSuppliers: () => req<MarketplaceSupplier[]>(`/admin/suppliers`),
  adminUpdateSupplier: (id: string, body: { is_verified?: boolean; is_active?: boolean }) =>
    req<MarketplaceSupplier>(`/admin/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  adminDecideSupplier: (id: string, decision: "approved" | "rejected", reason: string) =>
    req<MarketplaceSupplier>(`/admin/suppliers/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    }),
  adminListProducts: (active?: boolean) =>
    req<UnknownRecord[]>(`/admin/products${active === undefined ? "" : `?active=${active}`}`),
  adminSetProductActive: (id: string, isActive: boolean) =>
    req<UnknownRecord>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify({ is_active: isActive }) }),
  adminDecideProduct: (id: string, decision: "approved" | "rejected", reason: string) =>
    req<UnknownRecord>(`/admin/products/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    }),
  adminListReviews: () => req<MarketplaceReview[]>(`/admin/reviews`),
  adminDecideReview: (id: string, decision: "approved" | "rejected", reason: string) =>
    req<MarketplaceReview>(`/admin/reviews/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    }),
  updateOrderStatus: (id: string, status: string, reason?: string) =>
    req<MarketplaceOrder>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(reason != null ? { status, reason } : { status }) }),

  // Buyer pays at the awaiting_payment stage (records method → advances to preparing).
  startTestPayment: (id: string, requestId: string) =>
    req<MarketplacePayment>(`/orders/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ method: "test", request_id: requestId }),
    }),
  openDispute: (orderId: string, reason: string) =>
    req<MarketplaceDispute>(`/orders/${orderId}/disputes`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminListDisputes: (status = "open") =>
    req<MarketplaceDispute[]>(`/admin/disputes?status=${encodeURIComponent(status)}`),
  adminResolveDispute: (
    id: string,
    body: {
      decision: "refund" | "reject";
      reason: string;
      request_id: string;
      confirm: true;
    },
  ) => req<MarketplaceDispute>(`/admin/disputes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(body),
  }),

  // Supplier reviews.
  getSupplierReviews: (supplierId: string) => req<SupplierReviewsResponse>(`/suppliers/${supplierId}/reviews`),
  postSupplierReview: (supplierId: string, body: { rating: number; comment?: string }) =>
    req<MarketplaceReview>(`/suppliers/${supplierId}/reviews`, { method: "POST", body: JSON.stringify(body) }),
};
