import { beforeEach, describe, expect, it, vi } from "vitest";
import { lab } from "./lab";

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Sprint 7 lab API", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses cursor pagination and never calls the removed paid command", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response([]));
    await lab.listOrders({
      status: "ready",
      limit: "50",
      created_before: "2026-07-25T10:00:00Z",
      before_id: "order-1",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "created_before=2026-07-25T10%3A00%3A00Z",
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("before_id=order-1");
    expect("markPaid" in lab).toBe(false);
  });

  it("supports receive, settlement, dispute and material ledger commands", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => response({ ok: true }));

    await lab.receiveOrder("order-1", "Received");
    await lab.createSettlement("order-1", {
      entry_type: "PAYMENT",
      amount: 100_000,
      currency: "UZS",
      method: "CASH",
      note: "",
      client_request_id: "11111111-1111-4111-8111-111111111111",
    });
    await lab.openDispute("order-1", "Shade mismatch");
    await lab.adjustMaterial("material-1", {
      delta: -1,
      reason: "order consumption",
      client_request_id: "22222222-2222-4222-8222-222222222222",
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/lab/orders/order-1/receive",
      "/api/v1/lab/orders/order-1/settlements",
      "/api/v1/lab/orders/order-1/disputes",
      "/api/v1/lab/materials/material-1/delta",
    ]);
  });
});
