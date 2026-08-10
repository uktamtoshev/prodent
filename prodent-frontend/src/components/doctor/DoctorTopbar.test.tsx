import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { DoctorTopbar } from "./DoctorTopbar";
import { CabinetShellProvider } from "@/components/shared/CabinetShellContext";
import { CabinetTopBar } from "@/components/shared/CabinetTopBar";

vi.mock("@/components/notifications/NotificationBell", () => ({
  NotificationBell: () => (
    <button type="button" className="h-11 w-11" aria-label="Уведомления" />
  ),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "doctorLayout.searchPlaceholder": "Найти пациента",
        "doctorLayout.notifications": "Уведомления",
        "roleSidebar.toggleNavigation": "Открыть меню",
        "crm.patients": "Пациенты",
        "crm.home": "Главная",
      };
      return translations[key] ?? key;
    },
  }),
}));

/** The cabinet frame a doctor page actually renders inside. */
const inCabinet = (page: ReactNode, route = "/doctor/patients") => (
  <MemoryRouter initialEntries={[route]}>
    <CabinetShellProvider>
      <CabinetTopBar />
      {page}
    </CabinetShellProvider>
  </MemoryRouter>
);

describe("DoctorTopbar publishes into the single cabinet bar", () => {
  it("renders no header of its own", () => {
    // It used to render a 72px <header> with its own h1 and its own
    // notification bell, stacking a second header under the layout's bar.
    const { container } = render(<DoctorTopbar title="Пациенты" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("puts the page title in the shared bar as the only h1", () => {
    render(inCabinet(<DoctorTopbar title="Пациенты" />));

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Пациенты");
  });

  it("leaves exactly one notification bell on screen", () => {
    render(inCabinet(<DoctorTopbar title="Пациенты" />));

    expect(screen.getAllByRole("button", { name: "Уведомления" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Уведомления" })).toHaveClass(
      "h-11",
      "w-11",
    );
  });

  it("exposes a search field in the bar when the page can search", () => {
    const onSearch = vi.fn();
    render(inCabinet(<DoctorTopbar title="Пациенты" onSearch={onSearch} />));

    expect(
      screen.getByRole("searchbox", { name: "Найти пациента" }),
    ).toBeInTheDocument();
  });

  it("does not show a search field that cannot perform a search", () => {
    render(inCabinet(<DoctorTopbar title="Пациенты" />));

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("keeps helper text on the type scale, never below 12px", () => {
    render(inCabinet(<DoctorTopbar title="Пациенты" subtitle="Сегодня 8 приёмов" />));

    // Was an arbitrary `text-[12.5px]`; the scale's `text-xs` is 12px, the
    // documented floor for product text.
    expect(screen.getByText("Сегодня 8 приёмов")).toHaveClass(
      "text-xs",
      "text-muted-foreground",
    );
  });

  it("portals page actions into the bar instead of a second header", () => {
    render(
      inCabinet(
        <DoctorTopbar
          title="Маркетплейс"
          right={<button type="button">Корзина</button>}
        />,
      ),
    );

    const bar = screen.getByRole("banner");
    expect(bar).toContainElement(screen.getByRole("button", { name: "Корзина" }));
  });

  it("still renders actions when mounted outside a cabinet shell", () => {
    // A page reachable from a non-migrated shell must not silently lose its
    // buttons just because there is no portal target.
    render(
      <MemoryRouter>
        <DoctorTopbar title="Маркетплейс" right={<button type="button">Корзина</button>} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Корзина" })).toBeInTheDocument();
  });
});
