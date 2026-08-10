import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import {
  getInitialLanguage,
  initializeLanguage,
  LanguageProvider,
  tGlobal,
  useLanguage,
} from "@/contexts/LanguageContext";
import { LanguageRuntime, languageRuntime } from "./language-runtime";
import type { LanguageStorage } from "./language-storage";
import { LocaleLoader, localeLoader } from "./locale-loader";
import type { LocaleImporters, LocaleModule } from "./locale-loader";
import { SUPPORTED_LANGUAGES } from "./types";
import type { Language, TranslationDictionary } from "./types";

function locale(dictionary: TranslationDictionary): Promise<LocaleModule> {
  return Promise.resolve({ default: dictionary });
}

function importers(
  overrides: Partial<LocaleImporters> = {},
): LocaleImporters {
  const base = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [
      language,
      () => locale({ common: { value: language } }),
    ]),
  ) as LocaleImporters;

  return { ...base, ...overrides };
}

function deferredLocale(): {
  promise: Promise<LocaleModule>;
  resolve: (module: LocaleModule) => void;
} {
  let resolve!: (module: LocaleModule) => void;
  const promise = new Promise<LocaleModule>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function memoryStorage(initialValue: string | null): LanguageStorage & { value: string | null } {
  const storage = {
    value: initialValue,
    getItem: () => storage.value,
    setItem: (_key: string, value: string) => {
      storage.value = value;
    },
    removeItem: () => {
      storage.value = null;
    },
  };
  return storage;
}

function LanguageHarness(): React.ReactElement {
  const { language, setLanguage } = useLanguage();
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("output", { "aria-label": "current language" }, language),
    React.createElement(
      "button",
      { type: "button", onClick: () => setLanguage("kg") },
      "Choose Kyrgyz",
    ),
  );
}

describe("locale dictionaries", () => {
  it.each(SUPPORTED_LANGUAGES)("loads the %s dictionary", async (language) => {
    const dictionary = await localeLoader.load(language);

    expect(dictionary).toHaveProperty("nav.home");
    expect(typeof (dictionary.nav as TranslationDictionary).home).toBe("string");
  });

  it("caches concurrent imports", async () => {
    const importer = vi.fn(() => locale({ common: { value: "Русский" } }));
    const loader = new LocaleLoader(importers({ ru: importer }));

    const [first, second] = await Promise.all([loader.load("ru"), loader.load("ru")]);

    expect(first).toBe(second);
    expect(importer).toHaveBeenCalledTimes(1);
  });
});

describe("saved language", () => {
  it("restores every supported persisted language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      localStorage.setItem("language", language);
      expect(getInitialLanguage()).toBe(language);
    }
  });

  it("maps the removed legacy English value to Russian", () => {
    localStorage.setItem("language", "en");

    expect(getInitialLanguage()).toBe("ru");
    expect(localStorage.getItem("language")).toBeNull();
  });

  it("returns Russian when storage read or legacy cleanup is blocked", () => {
    const blockedRead: LanguageStorage = {
      getItem: () => { throw new DOMException("blocked", "SecurityError"); },
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const blockedCleanup: LanguageStorage = {
      getItem: () => "en",
      setItem: vi.fn(),
      removeItem: () => { throw new DOMException("blocked", "SecurityError"); },
    };

    expect(getInitialLanguage(blockedRead)).toBe("ru");
    expect(getInitialLanguage(blockedCleanup)).toBe("ru");
  });

  it("replaces a saved locale with Russian when its chunk cannot load", async () => {
    const storage = memoryStorage("uz");
    const runtime = new LanguageRuntime(
      new LocaleLoader(
        importers({
          ru: () => locale({ common: { value: "ru" } }),
          uz: () => Promise.reject(new Error("chunk unavailable")),
        }),
      ),
    );

    const initialized = await initializeLanguage(getInitialLanguage(storage), { runtime, storage });

    expect(initialized).toBe("ru");
    expect(runtime.getLanguage()).toBe("ru");
    expect(storage.value).toBe("ru");
    expect(getInitialLanguage(storage)).toBe("ru");
  });

  it("clears a broken saved locale when replacing it is blocked", async () => {
    const storage = memoryStorage("uz");
    storage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
    const runtime = new LanguageRuntime(
      new LocaleLoader(
        importers({
          ru: () => locale({ common: { value: "ru" } }),
          uz: () => Promise.reject(new Error("chunk unavailable")),
        }),
      ),
    );

    await initializeLanguage("uz", { runtime, storage });

    expect(storage.value).toBeNull();
  });
});

describe("language runtime", () => {
  it("falls back to Russian only when the selected dictionary misses a key", async () => {
    const loader = new LocaleLoader(
      importers({
        ru: () => locale({ actions: { save: "Сохранить" } }),
        uz: () => locale({ actions: {} }),
      }),
    );
    const runtime = new LanguageRuntime(loader);

    await runtime.switchLanguage("uz");

    expect(runtime.translate("actions.save")).toBe("Сохранить");
    expect(runtime.translate("actions.unknown")).toBe("actions.unknown");
  });

  it("loads app translations only when a protected area asks for them", async () => {
    const loader = new LocaleLoader({
      base: importers({
        ru: () => locale({ common: { ok: "ÐžÐº" } }),
        uz: () => locale({ common: { ok: "OK" } }),
      }),
      app: importers({
        ru: () => locale({ crm: { title: "CRM" } }),
        uz: () => locale({ crm: { title: "CRM UZ" } }),
      }),
    });
    const runtime = new LanguageRuntime(loader);

    await runtime.switchLanguage("uz");

    expect(runtime.translate("common.ok")).toBe("OK");
    expect(runtime.translate("crm.title")).toBe("crm.title");

    await runtime.loadNamespace("app");

    expect(runtime.translate("crm.title")).toBe("CRM UZ");
  });

  it("keeps the newest language during rapid switches", async () => {
    const slowUzbek = deferredLocale();
    const fastKazakh = deferredLocale();
    const loader = new LocaleLoader(
      importers({
        ru: () => locale({ common: { value: "ru" } }),
        uz: () => slowUzbek.promise,
        kz: () => fastKazakh.promise,
      }),
    );
    const runtime = new LanguageRuntime(loader);
    await runtime.switchLanguage("ru");

    const uzbekSwitch = runtime.switchLanguage("uz");
    const kazakhSwitch = runtime.switchLanguage("kz");
    fastKazakh.resolve({ default: { common: { value: "kz" } } });
    expect(await kazakhSwitch).toBe(true);
    slowUzbek.resolve({ default: { common: { value: "uz" } } });

    expect(await uzbekSwitch).toBe(false);
    expect(runtime.getLanguage()).toBe("kz");
    expect(runtime.translate("common.value")).toBe("kz");
  });

  it("preserves the old language when a new locale import fails", async () => {
    const loader = new LocaleLoader(
      importers({
        ru: () => locale({ common: { value: "ru" } }),
        uz: () => Promise.reject(new Error("chunk unavailable")),
      }),
    );
    const runtime = new LanguageRuntime(loader);
    await runtime.switchLanguage("ru");

    await expect(runtime.switchLanguage("uz")).rejects.toThrow("chunk unavailable");
    expect(runtime.getLanguage()).toBe("ru");
    expect(runtime.translate("common.value")).toBe("ru");
  });

  it("loads the app namespace without losing base translations", async () => {
    const loader = new LocaleLoader({
      base: importers({
        ru: () => locale({ common: { save: "save-ru" }, nav: { home: "home-ru" } }),
        uz: () => locale({ common: { save: "save-uz" }, nav: { home: "home-uz" } }),
      }),
      app: importers({
        ru: () => locale({ crm: { dashboard: "crm-ru" } }),
        uz: () => locale({ crm: { dashboard: "crm-uz" } }),
      }),
    });
    const runtime = new LanguageRuntime(loader);

    await runtime.switchLanguage("uz");
    expect(runtime.translate("nav.home")).toBe("home-uz");
    expect(runtime.translate("crm.dashboard")).toBe("crm.dashboard");

    await runtime.loadNamespace("app");

    expect(runtime.translate("nav.home")).toBe("home-uz");
    expect(runtime.translate("crm.dashboard")).toBe("crm-uz");
  });

  it("loads several app namespaces without the full app dictionary", async () => {
    const loader = new LocaleLoader({
      base: importers({
        ru: () => locale({ common: { save: "save-ru" } }),
        uz: () => locale({ common: { save: "save-uz" } }),
      }),
      crm: importers({
        ru: () => locale({ crm: { dashboard: "crm-ru" } }),
        uz: () => locale({ crm: { dashboard: "crm-uz" } }),
      }),
      doctor: importers({
        ru: () => locale({ doctor: { patients: "doctor-patients-ru" } }),
        uz: () => locale({ doctor: { patients: "doctor-patients-uz" } }),
      }),
    });
    const runtime = new LanguageRuntime(loader);

    await runtime.switchLanguage("uz");
    await runtime.loadNamespaces(["crm", "doctor"]);

    expect(runtime.translate("common.save")).toBe("save-uz");
    expect(runtime.translate("crm.dashboard")).toBe("crm-uz");
    expect(runtime.translate("doctor.patients")).toBe("doctor-patients-uz");
  });

  it("uses Russian app fallback when the selected app namespace misses a key", async () => {
    const loader = new LocaleLoader({
      base: importers({
        ru: () => locale({ common: { save: "save-ru" } }),
        uz: () => locale({ common: { save: "save-uz" } }),
      }),
      app: importers({
        ru: () => locale({ crm: { dashboard: "crm-ru" } }),
        uz: () => locale({ crm: {} }),
      }),
    });
    const runtime = new LanguageRuntime(loader);

    await runtime.switchLanguage("uz");
    await runtime.loadNamespace("app");

    expect(runtime.translate("crm.dashboard")).toBe("crm-ru");
  });
});

describe("global translator", () => {
  afterAll(async () => {
    await initializeLanguage("ru");
  });

  it("uses the newly activated language outside React", async () => {
    const language: Language = "uz";
    const dictionary = await localeLoader.load(language);
    const expected = (dictionary.nav as TranslationDictionary).home;

    await initializeLanguage(language);

    expect(tGlobal("nav.home")).toBe(expected);
  });

  it("activates the persisted language on a fresh bootstrap", async () => {
    localStorage.setItem("language", "tj");
    const expected = (await localeLoader.load("tj")).nav as TranslationDictionary;

    await initializeLanguage(getInitialLanguage());

    expect(tGlobal("nav.home")).toBe(expected.home);
  });
});

describe("LanguageProvider", () => {
  it("does not let delayed country detection overwrite a manual choice", async () => {
    await initializeLanguage("ru");
    localStorage.clear();
    const countryResponse = deferred<Response>();
    let detectionSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      detectionSignal = init?.signal ?? undefined;
      return countryResponse.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      React.createElement(LanguageProvider, null, React.createElement(LanguageHarness)),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    await userEvent.click(screen.getByRole("button", { name: "Choose Kyrgyz" }));
    await waitFor(() => {
      expect(screen.getByLabelText("current language")).toHaveTextContent("kg");
      expect(localStorage.getItem("language")).toBe("kg");
    });
    expect(detectionSignal?.aborted).toBe(true);

    await act(async () => {
      countryResponse.resolve({
        json: async () => ({ country_code: "UZ" }),
      } as Response);
      await countryResponse.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("current language")).toHaveTextContent("kg");
    expect(localStorage.getItem("language")).toBe("kg");
    await initializeLanguage("ru");
  });

  it("keeps the active language and saved value when a manual locale load fails", async () => {
    toastError.mockClear();
    await initializeLanguage("ru");
    localStorage.setItem("language", "ru");
    const originalSwitch = languageRuntime.switchLanguage.bind(languageRuntime);
    const switchSpy = vi
      .spyOn(languageRuntime, "switchLanguage")
      .mockImplementation((nextLanguage) =>
        nextLanguage === "kg"
          ? Promise.reject(new Error("chunk unavailable"))
          : originalSwitch(nextLanguage),
      );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      React.createElement(LanguageProvider, null, React.createElement(LanguageHarness)),
    );
    await userEvent.click(screen.getByRole("button", { name: "Choose Kyrgyz" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("current language")).toHaveTextContent("ru");
    expect(localStorage.getItem("language")).toBe("ru");

    switchSpy.mockRestore();
    consoleError.mockRestore();
  });

  it("keeps the manually loaded language when storage writing is blocked", async () => {
    toastError.mockClear();
    await initializeLanguage("ru");
    localStorage.setItem("language", "ru");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    render(
      React.createElement(LanguageProvider, null, React.createElement(LanguageHarness)),
    );
    await userEvent.click(screen.getByRole("button", { name: "Choose Kyrgyz" }));

    await waitFor(() => {
      expect(screen.getByLabelText("current language")).toHaveTextContent("kg");
      expect(toastError).toHaveBeenCalledOnce();
    });
    expect(localStorage.getItem("language")).toBe("ru");
    await initializeLanguage("ru");
  });
});
