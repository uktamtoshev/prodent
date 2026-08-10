import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptySellerDashboard,
  hasSellerDashboardActivity,
  marketplace,
  normalizeSellerDashboard,
  sellerDashboardToCsv,
} from "./marketplace";

const dashboardPayload = {
  has_storefront: true,
  supplier_id: "supplier-1",
  currency: "UZS",
  revenue_total: 1_250_000,
  revenue_30_days: 900_000,
  revenue_7_days: 420_000,
  order_count: 7,
  completed_order_count: 4,
  cancelled_order_count: 1,
  returned_order_count: 0,
  returns_supported: false,
  average_order: 312_500,
  status_counts: {
    new: 1,
    accepted: 1,
    awaiting_payment: 0,
    preparing: 0,
    shipped: 0,
    received: 1,
    completed: 4,
    cancelled: 1,
  },
  active_product_count: 5,
  low_stock_count: 2,
  out_of_stock_count: 1,
  review_count: 3,
  average_rating: 4.7,
  daily_revenue_7_days: [
    { date: "2026-07-21", revenue: 120_000 },
    { date: "2026-07-22", revenue: 300_000 },
  ],
  top_products: [
    { product_id: "product-1", name: "Композит, A2", sku: "SKU-1", units_sold: 3, revenue: 300_000 },
  ],
};

describe("seller marketplace dashboard contract", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "seller-token");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("maps the backend DTO without inventing return or finance data", () => {
    const dashboard = normalizeSellerDashboard(dashboardPayload);

    expect(dashboard.revenue_30_days).toBe(900_000);
    expect(dashboard.status_counts.new).toBe(1);
    expect(dashboard.top_products[0]).toEqual(dashboardPayload.top_products[0]);
    expect(dashboard.returned_order_count).toBe(0);
    expect(dashboard.returns_supported).toBe(false);
  });

  it("returns a deterministic empty dashboard for missing storefront data", () => {
    const dashboard = normalizeSellerDashboard(null);

    expect(dashboard).toEqual(emptySellerDashboard());
    expect(hasSellerDashboardActivity(dashboard)).toBe(false);
  });

  it("recognizes real storefront activity", () => {
    expect(hasSellerDashboardActivity(normalizeSellerDashboard(dashboardPayload))).toBe(true);
  });

  it("builds CSV only from real dashboard values and escapes product names", () => {
    const csv = sellerDashboardToCsv(normalizeSellerDashboard(dashboardPayload));

    expect(csv).toContain("Выручка за 30 дней,900000 UZS");
    expect(csv).toContain('"Композит, A2",SKU-1,3,300000 UZS');
    expect(csv).not.toContain("Демо");
  });

  it("loads the owner-scoped dashboard with the seller token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(dashboardPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(marketplace.getDashboard()).resolves.toMatchObject({ supplier_id: "supplier-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/marketplace/dashboard",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer seller-token" }),
      }),
    );
  });

  it("keeps supplier orders owner-scoped", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await marketplace.listOrders("supplier");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/marketplace/orders?role=supplier",
      expect.any(Object),
    );
  });

  it("surfaces a backend error instead of replacing it with fake data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "Storefront is not available" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )));

    await expect(marketplace.getDashboard()).rejects.toThrow("Storefront is not available");
  });
});

describe("Sprint 9 marketplace API contract", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "admin-token");
  });

  afterEach(() => vi.unstubAllGlobals());

  const ok = (payload: unknown = {}) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("uses bounded server-side catalog filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], page: 2, size: 24, has_more: false }));
    vi.stubGlobal("fetch", fetchMock);

    await marketplace.listCatalog({
      page: 2,
      size: 24,
      search: "композит",
      category: "Материалы",
      minPrice: 100,
      maxPrice: 500,
      sort: "price_asc",
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/marketplace/catalog?page=2&size=24&search=%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%B7%D0%B8%D1%82&category=%D0%9C%D0%B0%D1%82%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%D1%8B&minPrice=100&maxPrice=500&sort=price_asc",
    );
  });

  it("sends explicit reasons for supplier and product decisions", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok({})));
    vi.stubGlobal("fetch", fetchMock);

    await marketplace.adminDecideSupplier("supplier-1", "approved", "Документы проверены");
    await marketplace.adminDecideProduct("product-1", "rejected", "Неверная цена");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/marketplace/admin/suppliers/supplier-1/decision",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "approved", reason: "Документы проверены" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/marketplace/admin/products/product-1/decision",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "rejected", reason: "Неверная цена" }) }),
    );
  });

  it("sends an explicit reason for review moderation", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok({})));
    vi.stubGlobal("fetch", fetchMock);

    await marketplace.adminDecideReview("review-1", "rejected", "Нарушение правил");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/marketplace/admin/reviews/review-1/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decision: "rejected", reason: "Нарушение правил" }),
      }),
    );
  });

  it("keeps checkout and test payment idempotency keys in request bodies", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok({})));
    vi.stubGlobal("fetch", fetchMock);

    await marketplace.placeOrder({
      supplier_id: "supplier-1",
      client_request_id: "checkout-1",
      items: [{ product_id: "product-1", quantity: 2 }],
    });
    await marketplace.startTestPayment("order-1", "payment-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/marketplace/orders",
      expect.objectContaining({ body: expect.stringContaining('"client_request_id":"checkout-1"') }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/marketplace/orders/order-1/pay",
      expect.objectContaining({ body: JSON.stringify({ method: "test", request_id: "payment-1" }) }),
    );
  });

  it("opens and safely resolves disputes without exposing callback secrets", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok({})));
    vi.stubGlobal("fetch", fetchMock);

    await marketplace.openDispute("order-1", "Товар повреждён");
    await marketplace.adminResolveDispute("dispute-1", {
      decision: "refund",
      reason: "Подтверждено фото",
      request_id: "refund-1",
      confirm: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/marketplace/orders/order-1/disputes",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/marketplace/admin/disputes/dispute-1/resolve",
      expect.objectContaining({ body: expect.stringContaining('"confirm":true') }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("X-Marketplace-Signature");
  });
});
