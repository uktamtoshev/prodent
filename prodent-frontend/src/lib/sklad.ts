// Client for the secure Склад API (/api/v1/sklad).
// Like the Jobs module, the Склад module routes EVERY call (reads included)
// through this controller — nothing is read off the generic data proxy, so a
// doctor's personal stock stays private and one clinic never sees another's.
// The server decides which warehouse space (clinic vs personal) the caller is in
// from their role; the client just calls the endpoints.

const API_BASE = "/api/v1/sklad";
const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

function doFetch(path: string, opts: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const clinicId = localStorage.getItem("prodent_current_clinic");
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(clinicId ? { "X-Clinic-Id": clinicId } : {}),
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

export type WarehouseMode = "clinic" | "personal";
export type StockOpType = "income" | "expense" | "adjustment";

export interface SkladItem {
  id: string;
  name: string;
  category: string | null;
  category_id: string | null;
  unit: string | null;
  quantity: number;
  min_quantity: number;
  max_quantity: number | null;
  price_per_unit: number | null;
  supplier: string | null;
  supplier_id: string | null;
  brand: string | null;
  sku: string | null;
  location: string | null;
  expiry_date: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface SkladStats {
  total_items: number;
  low_stock: number;
  expiring: number;
  total_value: number;
}

export interface SkladCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

export interface SkladSupplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  inn: string | null;
  notes: string | null;
}

export interface SkladTransaction {
  id: string;
  inventory_id: string;
  item_name: string | null;
  item_unit: string | null;
  quantity: number;
  type: StockOpType;
  reason: string | null;
  price_per_unit: number | null;
  total_price: number | null;
  balance_after: number | null;
  inventory_batch_id?: string | null;
  batch_id?: string | null;
  appointment_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  client_request_id?: string | null;
  created_at: string;
}

export interface SkladBatch {
  id: string;
  inventory_id: string;
  batch_number: string | null;
  quantity: number;
  expiry_date: string | null;
  supplier_id: string | null;
  received_at?: string | null;
}

export interface StockCommand {
  type: StockOpType;
  quantity: number;
  reason?: string;
  client_request_id?: string;
  batch_id?: string;
  appointment_id?: string;
  target_type?: string;
  target_id?: string;
}

export interface ReceiptCommand {
  quantity: number;
  batch_number?: string;
  expiry_date?: string;
  supplier_id?: string;
  reason?: string;
  client_request_id?: string;
}

export interface TransferCommand {
  destination_inventory_id: string;
  quantity: number;
  reason?: string;
  client_request_id?: string;
}

export interface InventoryCountCommand {
  counted_quantity: number;
  note?: string;
  client_request_id?: string;
}

export interface ItemFilters {
  q?: string;
  category_id?: string;
  low?: string;
  expiring?: string;
}

// ── API ──────────────────────────────────────────────────────────────────────

export const sklad = {
  me: () => req<{ mode: WarehouseMode; scope_id: string }>("/me"),

  // Items
  listItems: (f: ItemFilters = {}) => req<SkladItem[]>(`/items${qs(f)}`),
  getItem: (id: string) => req(`/items/${id}`),
  createItem: (body: Record<string, unknown>) =>
    req<SkladItem>("/items", { method: "POST", body: JSON.stringify(body) }),
  updateItem: (id: string, body: Record<string, unknown>) =>
    req<SkladItem>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteItem: (id: string) => req(`/items/${id}`, { method: "DELETE" }),
  stock: (
    id: string,
    type: StockOpType,
    quantity: number,
    reason?: string,
    links: Omit<StockCommand, "type" | "quantity" | "reason"> = {},
  ) =>
    req(`/items/${id}/stock`, {
      method: "POST",
      body: JSON.stringify({ type, quantity, reason, ...links }),
    }),
  listBatches: (id: string) => req<SkladBatch[]>(`/items/${id}/batches`),
  receive: (id: string, command: ReceiptCommand) =>
    req(`/items/${id}/receipts`, {
      method: "POST",
      body: JSON.stringify(command),
    }),
  transfer: (id: string, command: TransferCommand) =>
    req(`/items/${id}/transfers`, {
      method: "POST",
      body: JSON.stringify(command),
    }),
  inventoryCount: (id: string, command: InventoryCountCommand) =>
    req(`/items/${id}/inventory-counts`, {
      method: "POST",
      body: JSON.stringify(command),
    }),

  // Movements / stats
  listTransactions: async (f: { inventory_id?: string; type?: string; limit?: string } = {}) => {
    const rows = await req<SkladTransaction[]>(`/transactions${qs(f)}`);
    return rows.map((row) => ({
      ...row,
      batch_id: row.batch_id ?? row.inventory_batch_id ?? null,
    }));
  },
  stats: () => req<SkladStats>("/stats"),
  exportCsv: async () => {
    let res = await doFetch("/export", {
      headers: { Accept: "text/csv" },
    });
    if (res.status === 401 && (await tryRefresh())) {
      res = await doFetch("/export", {
        headers: { Accept: "text/csv" },
      });
    }
    if (!res.ok) {
      const text = await res.text();
      let message = `HTTP ${res.status}`;
      try {
        const data = JSON.parse(text) as { error?: string; message?: string };
        message = data.error || data.message || message;
      } catch {
        if (text) message = text;
      }
      throw new Error(message);
    }
    return res.blob();
  },

  // Categories
  listCategories: () => req<SkladCategory[]>("/categories"),
  createCategory: (body: Record<string, unknown>) =>
    req<SkladCategory>("/categories", { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (id: string, body: Record<string, unknown>) =>
    req<SkladCategory>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCategory: (id: string) => req(`/categories/${id}`, { method: "DELETE" }),

  // Suppliers
  listSuppliers: () => req<SkladSupplier[]>("/suppliers"),
  createSupplier: (body: Record<string, unknown>) =>
    req<SkladSupplier>("/suppliers", { method: "POST", body: JSON.stringify(body) }),
  updateSupplier: (id: string, body: Record<string, unknown>) =>
    req<SkladSupplier>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSupplier: (id: string) => req(`/suppliers/${id}`, { method: "DELETE" }),
};
