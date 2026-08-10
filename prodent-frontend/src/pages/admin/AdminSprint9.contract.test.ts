import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Sprint 9 frontend safety contracts", () => {
  it("guards every admin route with the explicit role boundary", () => {
    const app = source("src/App.tsx");
    const adminBlock = app.slice(
      app.indexOf('<Route element={<AdminRouteBoundary />}>'),
      app.indexOf("{/* Staff pages"),
    );

    expect(adminBlock).toContain('path="/admin/patients"');
    expect(adminBlock).toContain('path="/admin/market/disputes"');
    expect(adminBlock.trim().endsWith("</Route>")).toBe(true);
  });

  it("does not expose buyer orders or medical/system pages in the moderator menu", () => {
    const sidebar = source("src/components/admin/AdminSidebar.tsx");
    const moderatorMenu = sidebar.slice(sidebar.indexOf("() => isModerator ? ["), sidebar.indexOf("] : ["));

    expect(moderatorMenu).toContain("/admin/moderation");
    expect(moderatorMenu).toContain("/admin/market/products");
    expect(moderatorMenu).toContain("/admin/market/reviews");
    expect(moderatorMenu).toContain("/admin/market/disputes");
    expect(moderatorMenu).not.toContain("/admin/market/orders");
    expect(moderatorMenu).not.toContain("/admin/patients");
    expect(moderatorMenu).not.toContain("/admin/payments");
    expect(moderatorMenu).not.toContain("/admin/settings");
  });

  it("requires reasoned confirmations for marketplace moderation and refunds", () => {
    const dialog = source("src/components/admin/MarketplaceDecisionDialog.tsx");
    const sellers = source("src/pages/admin/MarketSellers.tsx");
    const products = source("src/pages/admin/MarketProducts.tsx");
    const disputes = source("src/pages/admin/MarketDisputes.tsx");
    const reviews = source("src/pages/admin/MarketReviews.tsx");

    expect(dialog).toContain("disabled={pending || !reason.trim()}");
    expect(sellers).toContain("adminDecideSupplier");
    expect(products).toContain("adminDecideProduct");
    expect(disputes).toContain("confirm: true");
    expect(disputes).toContain("!redacted");
    expect(disputes).toContain("onResolve('refund'");
    expect(reviews).toContain("adminDecideReview");
  });

  it("uses the frozen catalog verification field without trusting missing data", () => {
    const catalog = source("src/pages/market/MarketCatalog.tsx");

    expect(catalog).toContain("product.supplier_verified === true");
    expect(catalog).not.toContain("supplier_is_verified");
    expect(catalog).not.toContain("?? true");
  });

  it("renders the nested admin order history returned by the backend", () => {
    const orders = source("src/pages/admin/MarketOrders.tsx");
    const disputes = source("src/pages/admin/MarketDisputes.tsx");

    for (const field of ["o.payments", "o.refunds", "o.disputes", "o.reservations", "o.stock_events"]) {
      expect(orders).toContain(field);
    }
    for (const field of ["order?.payments", "order?.refunds", "order?.reservations", "order?.stock_events"]) {
      expect(disputes).toContain(field);
    }
    expect(disputes).not.toContain("const payment = dispute.payment");
    expect(disputes).not.toContain("dispute.refunds?.");
  });
});
