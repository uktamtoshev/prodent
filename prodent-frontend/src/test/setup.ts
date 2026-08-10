import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { languageRuntime } from "@/i18n/language-runtime";

/**
 * Load the Russian `base` dictionary into the translation runtime once.
 *
 * Components that resolve their own labels — the design-system layer reads
 * `system.*` so it does not ship hardcoded Russian — would otherwise render raw
 * keys ("system.actions") in unit tests that mount them without a
 * `LanguageProvider`. Priming the runtime makes tests see the same strings a
 * user sees, without forcing every test to wrap its subject in a provider.
 */
await languageRuntime.switchLanguage("ru");

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
