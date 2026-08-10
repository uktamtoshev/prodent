import { describe, expect, it } from "vitest";

import { formatAccountId } from "./accountId";

describe("formatAccountId", () => {
  it("keeps 64 stable bits from a UUID", () => {
    expect(formatAccountId("12345678-90ab-cdef-8123-456789abcdef"))
      .toBe("1234-5678-90AB-CDEF");
  });

  it("does not alias UUIDs that share only their first 32 bits", () => {
    const first = formatAccountId("12345678-90ab-cdef-8123-456789abcdef");
    const second = formatAccountId("12345678-fedc-ba09-8123-456789abcdef");

    expect(first).not.toBe(second);
  });

  it("returns null when no id exists", () => {
    expect(formatAccountId(null)).toBeNull();
    expect(formatAccountId(undefined)).toBeNull();
    expect(formatAccountId("")).toBeNull();
  });
});
