import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLabDraft,
  loadLabDraft,
  loadOrCreateLabRequestId,
  saveLabDraft,
} from "./lab-drafts";

describe("user-scoped laboratory drafts", () => {
  beforeEach(() => localStorage.clear());

  it("does not expose one user's draft to another user", () => {
    saveLabDraft("clarification:order-1", "user-a", "Shade A2?");

    expect(loadLabDraft("clarification:order-1", "user-a", "")).toBe("Shade A2?");
    expect(loadLabDraft("clarification:order-1", "user-b", "")).toBe("");
  });

  it("clears a sent draft", () => {
    saveLabDraft("message:order-1", "user-a", "Ready tomorrow");
    clearLabDraft("message:order-1", "user-a");
    expect(loadLabDraft("message:order-1", "user-a", "")).toBe("");
  });

  it("creates one request id before sending and reuses it for every retry", () => {
    let sequence = 0;
    const generate = () => `request-${++sequence}`;

    expect(loadOrCreateLabRequestId("new-order", "user-a", generate)).toBe(
      "request-1",
    );
    expect(loadOrCreateLabRequestId("new-order", "user-a", generate)).toBe(
      "request-1",
    );
    expect(loadOrCreateLabRequestId("new-order", "user-b", generate)).toBe(
      "request-2",
    );
  });
});
