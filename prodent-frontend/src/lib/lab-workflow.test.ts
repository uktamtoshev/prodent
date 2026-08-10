import { describe, expect, it } from "vitest";

import {
  getLabStatusLabel,
  getNextLabStatus,
  normalizeClarification,
  toTashkentOffsetDateTime,
} from "./lab-workflow";

describe("lab workflow", () => {
  it("moves an accepted order through the first production stages", () => {
    expect(getNextLabStatus("queued")).toBe("model");
    expect(getNextLabStatus("model")).toBe("wax");
    expect(getNextLabStatus("wax")).toBe("milling");
    expect(getNextLabStatus("delivered")).toBeNull();
    expect(getNextLabStatus("cancelled")).toBeNull();
  });

  it("gets status labels from the active translation dictionary", () => {
    const labels: Record<string, string> = {
      "labCustomer.status.new": "New order",
      "labCustomer.status.ready": "Ready",
    };
    const t = (key: string) => labels[key] ?? key;

    expect(getLabStatusLabel("new", t)).toBe("New order");
    expect(getLabStatusLabel("ready", t)).toBe("Ready");
    expect(getLabStatusLabel("unknown", t)).toBe("unknown");
  });

  it("requires meaningful clarification text", () => {
    expect(() => normalizeClarification("  ")).toThrow("clarification_required");
    expect(normalizeClarification("  Уточните оттенок  ")).toBe("Уточните оттенок");
  });

  it("keeps a technician deadline in the Tashkent timezone", () => {
    expect(toTashkentOffsetDateTime("2026-07-29T18:30")).toBe(
      "2026-07-29T18:30:00+05:00",
    );
    expect(toTashkentOffsetDateTime("")).toBeUndefined();
  });
});
