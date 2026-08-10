import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Sprint 6 laboratory frontend contracts", () => {
  it("uses only the scoped lab API for order workflow and discussions", () => {
    const api = source("src/lib/lab.ts");

    expect(api).toContain('const API_BASE = "/api/v1/lab"');
    expect(api).toContain("acceptOrder:");
    expect(api).toContain("declineOrder:");
    expect(api).toContain("advanceOrder:");
    expect(api).toContain("listMessages:");
    expect(api).toContain("createClarification:");
    expect(api).toContain("listOrderFiles:");
    expect(api).toContain("proposed_due_at");
    expect(api).toContain('"PENDING" | "ACCEPTED" | "REJECTED"');
  });

  it("carries safe visit or treatment-plan ids into order creation without PHI in URLs", () => {
    const customer = source("src/components/lab/LabOrdersCustomer.tsx");

    expect(customer).toContain('searchParams.get("medical_record_id")');
    expect(customer).toContain('searchParams.get("treatment_plan_id")');
    expect(customer).toContain('searchParams.get("treatment_plan_item_id")');
    expect(customer).toContain("...sourceContext");
    expect(customer).not.toContain('searchParams.get("patient_name")');
  });

  it("shows the authoritative event timeline without inventing a completed stage", () => {
    const detail = source("src/pages/technician/TechnicianOrder.tsx");

    expect(detail).toContain("events.map");
    expect(detail).not.toContain('to: "queued",');
    expect(detail).toContain("timeline.length === 0");
  });

  it("has real offline, RU/UZ and mobile states", () => {
    const detail = source("src/pages/technician/TechnicianOrder.tsx");
    const layout = source("src/components/technician/TechnicianLayout.tsx");
    const offline = source("src/components/technician/TechnicianOfflineBanner.tsx");

    expect(detail).toContain('language === "uz"');
    expect(detail).toContain("p-4 sm:p-6 lg:p-8");
    expect(layout).toContain("TechnicianOfflineBanner");
    expect(offline).toContain('role="status"');
    expect(offline).toContain('window.addEventListener("offline"');
  });

  it("uploads private files and rolls back storage when metadata registration fails", () => {
    const files = source("src/components/technician/LabOrderFilesPanel.tsx");

    expect(files).toContain('.from("documents").upload');
    expect(files).toContain("lab.registerOrderFile");
    expect(files).toContain('.from("documents").remove');
    expect(files).toContain("openPrivatePatientFile");
    expect(files).not.toContain("getPublicUrl");
  });
});
