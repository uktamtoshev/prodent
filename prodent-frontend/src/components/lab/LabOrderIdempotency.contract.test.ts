import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/lab/LabOrdersCustomer.tsx", "utf8");
const technicianSource = readFileSync(
  "src/pages/technician/TechnicianOrders.tsx",
  "utf8",
);

describe("lab order idempotency wiring", () => {
  it("persists one user-scoped request id and sends it with order retries", () => {
    expect(source).toContain("loadOrCreateLabRequestId");
    expect(source).toContain("client_request_id: clientRequestId");
    expect(source).toContain('clearLabDraft("new-order-request-id"');
  });

  it("uses the same protection for a technician self-order", () => {
    expect(technicianSource).toContain(
      'loadOrCreateLabRequestId(\n        "technician-new-order"',
    );
    expect(technicianSource).toContain(
      "client_request_id: clientRequestId",
    );
    expect(technicianSource).toContain(
      'clearLabDraft("technician-new-order-request-id"',
    );
  });
});
