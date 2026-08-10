import { beforeEach, describe, expect, it, vi } from "vitest";

import { lab } from "./lab";

describe("secure lab API client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads only the server-scoped order list with the bearer token", async () => {
    localStorage.setItem("prodent_access_token", "access-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { status: 200 }));

    await lab.listOrders({ status: "new", q: "crown" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/lab/orders?status=new&q=crown",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("sends a clarification as a real order message without a forged sender", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "message-1",
            order_id: "order-1",
            body: "Уточните оттенок",
            sender_user_id: "server-user",
            sender_role: "technician",
            created_at: "2026-07-25T10:00:00Z",
          }),
          { status: 200 },
        ),
      );

    await lab.sendClarification("order-1", "  Уточните оттенок  ");

    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe("/api/v1/lab/orders/order-1/messages");
    expect(JSON.parse(String(request[1]?.body))).toEqual({ body: "Уточните оттенок" });
  });

  it("rejects an empty clarification before making a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(lab.sendClarification("order-1", "   ")).rejects.toThrow(
      "clarification_required",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fake a successful write while the browser is offline", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      lab.sendMessage("order-1", "Сообщение", { online: false }),
    ).rejects.toThrow("offline");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the scoped clarification endpoint for a due date or price proposal", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "clarification-1",
            order_id: "order-1",
            message: "Подтвердите новый срок",
            proposed_due_at: "2026-07-29T18:00:00+05:00",
            status: "PENDING",
          }),
          { status: 200 },
        ),
      );

    await lab.createClarification("order-1", {
      message: "Подтвердите новый срок",
      due_at: "2026-07-29T18:00:00+05:00",
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/lab/orders/order-1/clarifications",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      message: "Подтвердите новый срок",
      due_at: "2026-07-29T18:00:00+05:00",
    });
  });

  it("does not create a structured clarification without a changed due date or price", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      lab.createClarification("order-1", { message: "Just a chat message" }),
    ).rejects.toThrow("clarification_change_required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers file metadata only through the order-scoped endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "file-1",
            order_id: "order-1",
            file_name: "scan.stl",
            storage_key: "tech/order-1/scan.stl",
            content_type: "model/stl",
            size_bytes: 100,
          }),
          { status: 200 },
        ),
      );

    await lab.registerOrderFile("order-1", {
      file_name: "scan.stl",
      storage_key: "tech/order-1/scan.stl",
      content_type: "model/stl",
      size_bytes: 100,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/lab/orders/order-1/files");
  });

  it("keeps visit and treatment-plan links when creating an order", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "order-1" }), { status: 200 }));

    await lab.createOrder({
      client_request_id: "request-1",
      technician_id: "tech-1",
      work_type: "Crown",
      medical_record_id: "visit-1",
      treatment_plan_id: "plan-1",
      treatment_plan_item_id: "item-1",
      patient_id: "patient-1",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      client_request_id: "request-1",
      technician_id: "tech-1",
      work_type: "Crown",
      medical_record_id: "visit-1",
      treatment_plan_id: "plan-1",
      treatment_plan_item_id: "item-1",
      patient_id: "patient-1",
    });
  });
});
