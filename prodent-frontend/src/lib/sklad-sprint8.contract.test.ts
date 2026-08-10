import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sklad } from "./sklad";
import { resolveSkladPermissions } from "@/hooks/useSkladPermissions";

const jsonResponse = (body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Sprint 8 sklad API contract", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "access-token");
    localStorage.setItem(
      "prodent_current_clinic",
      "11111111-1111-1111-1111-111111111111",
    );
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(jsonResponse())));
  });

  it("sends the selected clinic on every warehouse request", async () => {
    await sklad.stats();
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/sklad/stats",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "X-Clinic-Id": "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );
  });

  it("records a receipt with batch and expiry", async () => {
    await sklad.receive("item-1", {
      quantity: 12,
      batch_number: "LOT-12",
      expiry_date: "2027-01-31",
      client_request_id: "22222222-2222-2222-2222-222222222222",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/sklad/items/item-1/receipts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          quantity: 12,
          batch_number: "LOT-12",
          expiry_date: "2027-01-31",
          client_request_id: "22222222-2222-2222-2222-222222222222",
        }),
      }),
    );
  });

  it("links an expense to an appointment", async () => {
    await sklad.stock("item-1", "expense", 2, "Visit materials", {
      appointment_id: "33333333-3333-3333-3333-333333333333",
      client_request_id: "44444444-4444-4444-4444-444444444444",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/sklad/items/item-1/stock",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          quantity: 2,
          reason: "Visit materials",
          appointment_id: "33333333-3333-3333-3333-333333333333",
          client_request_id: "44444444-4444-4444-4444-444444444444",
        }),
      }),
    );
  });

  it("uses item-scoped transfer and inventory count endpoints", async () => {
    await sklad.transfer("item-1", {
      destination_inventory_id: "item-2",
      quantity: 3,
    });
    await sklad.inventoryCount("item-1", {
      counted_quantity: 17,
      note: "Counted by assistant",
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/sklad/items/item-1/transfers",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/sklad/items/item-1/inventory-counts",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("downloads CSV through the authenticated clinic-scoped client", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("name,quantity\r\nComposite,2", {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      }),
    );

    const blob = await sklad.exportCsv();

    expect(blob.type).toContain("text/csv");
    expect(blob.size).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/sklad/export",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "X-Clinic-Id": "11111111-1111-1111-1111-111111111111",
          Accept: "text/csv",
        }),
      }),
    );
  });

  it("maps the backend inventory batch field for the movement UI", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([
        {
          id: "tx-1",
          inventory_batch_id: "batch-1",
          type: "income",
        },
      ]),
    );

    const rows = await sklad.listTransactions();

    expect(rows[0].batch_id).toBe("batch-1");
  });

  it("keeps accountant and manager read-only and assistant catalog read-only", () => {
    expect(resolveSkladPermissions("accountant")).toEqual({
      canMutateStock: false,
      canManageCatalog: false,
    });
    expect(resolveSkladPermissions("clinic_manager")).toEqual({
      canMutateStock: false,
      canManageCatalog: false,
    });
    expect(resolveSkladPermissions("assistant")).toEqual({
      canMutateStock: true,
      canManageCatalog: false,
    });
  });

  it("exposes every operation in the mobile-safe warehouse UI", () => {
    const shared = readFileSync(
      resolve(process.cwd(), "src/components/sklad/SkladShared.tsx"),
      "utf8",
    );
    const items = readFileSync(
      resolve(process.cwd(), "src/pages/sklad/SkladItems.tsx"),
      "utf8",
    );
    const transactions = readFileSync(
      resolve(process.cwd(), "src/pages/sklad/SkladTransactions.tsx"),
      "utf8",
    );
    const layout = readFileSync(
      resolve(process.cwd(), "src/components/sklad/SkladLayout.tsx"),
      "utf8",
    );
    expect(shared).toContain("sklad.receive");
    expect(shared).toContain("appointment_id");
    expect(shared).toContain("sklad.transfer");
    expect(shared).toContain("sklad.inventoryCount");
    expect(items).toContain("<TransferDialog");
    expect(items).toContain("<InventoryCountDialog");
    expect(items).toContain('min-w-[900px]');
    expect(transactions).toContain('min-w-[980px]');
    expect(layout).toContain('"assistant"');
    expect(items).not.toContain("sklad.exportUrl");
    expect(items).toContain("sklad.exportCsv");
  });
});
