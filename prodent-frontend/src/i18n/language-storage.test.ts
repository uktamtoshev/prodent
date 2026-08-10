import { describe, expect, it, vi } from "vitest";

import {
  safeGetStoredLanguage,
  safeRemoveStoredLanguage,
  safeSetStoredLanguage,
} from "./language-storage";
import type { LanguageStorage } from "./language-storage";

function storageThatThrows(method: keyof LanguageStorage, errorName: string): LanguageStorage {
  return {
    getItem: method === "getItem" ? () => { throw new DOMException("blocked", errorName); } : () => "uz",
    setItem: method === "setItem" ? () => { throw new DOMException("blocked", errorName); } : vi.fn(),
    removeItem:
      method === "removeItem" ? () => { throw new DOMException("blocked", errorName); } : vi.fn(),
  };
}

describe("safe language storage", () => {
  it("returns null when reading throws SecurityError", () => {
    expect(safeGetStoredLanguage(storageThatThrows("getItem", "SecurityError"))).toBeNull();
  });

  it("returns false when writing throws QuotaExceededError", () => {
    expect(safeSetStoredLanguage("uz", storageThatThrows("setItem", "QuotaExceededError"))).toBe(
      false,
    );
  });

  it("returns false when removal throws SecurityError", () => {
    expect(safeRemoveStoredLanguage(storageThatThrows("removeItem", "SecurityError"))).toBe(false);
  });

  it("works normally when storage is available", () => {
    const storage: LanguageStorage = {
      getItem: vi.fn(() => "kg"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    expect(safeGetStoredLanguage(storage)).toBe("kg");
    expect(safeSetStoredLanguage("tj", storage)).toBe(true);
    expect(safeRemoveStoredLanguage(storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith("language", "tj");
    expect(storage.removeItem).toHaveBeenCalledWith("language");
  });
});
