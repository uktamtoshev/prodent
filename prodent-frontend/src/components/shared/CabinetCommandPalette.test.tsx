import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { languageRuntime } from "@/i18n/language-runtime";
import { CabinetCommandPalette } from "./CabinetCommandPalette";
import { CabinetShellProvider, useCabinetShell } from "./CabinetShellContext";
import { useEffect } from "react";

/**
 * jsdom ships neither of these, and `cmdk` uses both (a ResizeObserver to size
 * the list, scrollIntoView to keep the selected row visible). Stubbed locally
 * instead of in `src/test/setup.ts` so the other 180-odd suites keep running
 * against an unmodified environment.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const searchClinicPatients = vi.fn();

vi.mock("@/lib/crm-operations-api", () => ({
  searchClinicPatients: (...args: unknown[]) => searchClinicPatients(...args),
}));

vi.mock("@/contexts/ClinicContext", () => ({
  useClinic: () => ({ currentClinic: { id: "clinic-1" } }),
}));

/**
 * `t` is wired to the REAL runtime (warmed to Russian in `src/test/setup.ts`)
 * rather than an identity stub, so the assertions below also prove the new
 * `commandPalette.*` keys exist — `t()` returns the key itself when they do not.
 */
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "ru",
    t: (key: string) => languageRuntime.translate(key),
  }),
}));

/** Publishes a menu the way the real sidebar does. */
function PublishNav({ entries }: { entries: { title: string; path: string; group?: string }[] }) {
  const shell = useCabinetShell();
  const publish = shell?.publishNavEntries;
  useEffect(() => {
    publish?.(entries);
  }, [publish, entries]);
  return null;
}

const NAV = [
  { title: "Расписание", path: "/crm/schedule", group: "Пациенты" },
  { title: "Финансы", path: "/crm/finance", group: "Финансы" },
];

function renderPalette(entries = NAV) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/crm/schedule"]}>
        <CabinetShellProvider>
          <PublishNav entries={entries} />
          <CabinetCommandPalette />
          <Routes>
            <Route path="/crm/schedule" element={<p>Экран расписания</p>} />
            <Route path="/crm/finance" element={<p>Экран финансов</p>} />
            <Route path="/crm/patients/:id" element={<p>Карта пациента</p>} />
          </Routes>
        </CabinetShellProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The palette has no visible trigger; Ctrl+K on the document is the only way in. */
async function openPalette(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Control>}k{/Control}");
  return screen.findByRole("dialog");
}

describe("CabinetCommandPalette", () => {
  beforeEach(() => {
    searchClinicPatients.mockReset();
    searchClinicPatients.mockResolvedValue([]);
  });

  it("opens on Ctrl+K and offers only the sections the sidebar published", async () => {
    const user = userEvent.setup();
    renderPalette();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await openPalette(user);

    expect(screen.getByRole("option", { name: "Расписание" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Финансы" })).toBeInTheDocument();
    // The group labels come from the sidebar too, not from a second catalog.
    expect(screen.getByText("Пациенты")).toBeInTheDocument();
  });

  /**
   * The whole point of consuming `navEntries`: a viewer without the finance
   * module never sees a finance destination, because the sidebar already
   * dropped it. No permission logic is duplicated here to drift.
   */
  it("hides sections the sidebar filtered out by permission", async () => {
    const user = userEvent.setup();
    renderPalette([NAV[0]]);
    await openPalette(user);

    expect(screen.getByRole("option", { name: "Расписание" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Финансы" })).not.toBeInTheDocument();
  });

  it("navigates to the chosen section and closes", async () => {
    const user = userEvent.setup();
    renderPalette();
    await openPalette(user);

    await user.click(screen.getByRole("option", { name: "Финансы" }));

    expect(await screen.findByText("Экран финансов")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  /**
   * The backend declares `@Size(min = 2)` on the search query, so a one-letter
   * request is a guaranteed 400. Say what is needed instead of firing it.
   */
  it("asks for two characters instead of calling the API with one", async () => {
    const user = userEvent.setup();
    renderPalette();
    await openPalette(user);

    await user.type(screen.getByRole("combobox"), "а");

    // Announced, and visible even though "Расписание" still matches one letter —
    // as an empty-state this hint hid exactly when the list was non-empty.
    expect(screen.getByRole("status")).toHaveTextContent("Введите минимум 2 символа");
    expect(screen.getByRole("option", { name: "Расписание" })).toBeInTheDocument();
    expect(searchClinicPatients).not.toHaveBeenCalled();
  });

  it("finds patients from two characters and opens the chosen card", async () => {
    searchClinicPatients.mockResolvedValue([
      { id: "p-1", name: "Мадина Рахимова", phone: "+998710000003" },
    ]);
    const user = userEvent.setup();
    renderPalette();
    await openPalette(user);

    await user.type(screen.getByRole("combobox"), "ма");

    await waitFor(() =>
      expect(searchClinicPatients).toHaveBeenCalledWith("clinic-1", "ма"),
    );
    const hit = await screen.findByRole("option", { name: /Мадина Рахимова/ });
    expect(hit).toHaveTextContent("+998710000003");

    await user.click(hit);
    expect(await screen.findByText("Карта пациента")).toBeInTheDocument();
  });

  it("closes on Ctrl+K again and forgets the previous query", async () => {
    const user = userEvent.setup();
    renderPalette();
    await openPalette(user);
    await user.type(screen.getByRole("combobox"), "ма");

    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openPalette(user);
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
});
