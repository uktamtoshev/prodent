import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Home } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { RoleLayoutShell, RoleSidebar } from "./RoleSidebar";

const translations: Record<string, string> = {
  "roleSidebar.toggleNavigation": "Открыть или закрыть меню",
  "roleSidebar.switchToLightTheme": "Включить светлую тему",
  "roleSidebar.switchToDarkTheme": "Включить тёмную тему",
  "roleSidebar.switchLanguage": "Сменить язык",
  "roleSidebar.logout": "Выйти",
};

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ displayName: "Тестовый пользователь", accountNumber: "100" }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => translations[key] ?? key,
    language: "ru",
    setLanguage: vi.fn(),
  }),
  languageNames: { ru: "Русский" },
  languageFlags: { ru: "RU" },
}));

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <>
        <RoleSidebar
          roleLabel="Врач"
          items={[{ title: "Главная", path: "/home", icon: Home, badge: 3 }]}
        />
        <button type="button">Фоновое действие</button>
      </>
    </MemoryRouter>,
  );
}

describe("RoleSidebar mobile navigation", () => {
  it("keeps the closed mobile drawer outside the tab order and exposes its state", async () => {
    const user = userEvent.setup();
    renderSidebar();

    const trigger = screen.getByRole("button", { name: "Открыть или закрыть меню" });
    const drawer = screen.getByTestId("role-sidebar-mobile");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", drawer.id);
    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(drawer).toHaveAttribute("aria-hidden", "false");
    expect(drawer).not.toHaveAttribute("inert");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderSidebar();

    const trigger = screen.getByRole("button", { name: "Открыть или закрыть меню" });
    await user.click(trigger);
    await user.tab();
    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("traps Tab inside the open drawer and rejects background focus", async () => {
    const user = userEvent.setup();
    renderSidebar();

    const trigger = screen.getByRole("button", { name: "Открыть или закрыть меню" });
    const drawer = screen.getByTestId("role-sidebar-mobile");
    const backgroundButton = screen.getByRole("button", { name: "Фоновое действие" });

    await user.click(trigger);

    expect(drawer).toHaveAttribute("role", "dialog");
    expect(drawer).toHaveAttribute("aria-modal", "true");

    const lastItem = within(drawer).getByRole("button", { name: "Выйти" });
    lastItem.focus();
    await user.tab();
    expect(trigger).toHaveFocus();

    await user.tab({ shift: true });
    expect(lastItem).toHaveFocus();

    backgroundButton.focus();
    expect(backgroundButton).not.toHaveFocus();
    expect(trigger).toHaveFocus();
  });

  it("uses localized control labels and touch targets of at least 44px", () => {
    renderSidebar();

    const trigger = screen.getByRole("button", { name: "Открыть или закрыть меню" });
    expect(trigger).toHaveClass("h-11", "w-11");
    expect(screen.getByTestId("role-sidebar-mobile-toolbar")).toHaveClass("h-16", "lg:hidden");
    expect(screen.getAllByRole("button", { name: "Включить тёмную тему" })[0]).toHaveClass(
      "h-11",
      "min-w-11",
      "focus-visible:ring-2",
    );
    expect(screen.getAllByRole("button", { name: "Сменить язык" })[0]).toHaveClass(
      "h-11",
      "min-w-11",
      "focus-visible:ring-2",
    );
    expect(screen.getAllByRole("button", { name: "Выйти" })[0]).toHaveClass(
      "h-11",
      "min-w-11",
      "focus-visible:ring-2",
    );
  });

  it("exposes a labelled navigation landmark and marks the current route", () => {
    renderSidebar();

    expect(screen.getByRole("navigation", { name: "Врач" })).toBeInTheDocument();

    const currentLink = screen.getByRole("link", { name: "Главная 3" });
    expect(currentLink).toHaveAttribute("aria-current", "page");
    // Пункт меню теперь 38px на мыши — плотность из макета, больше разделов
    // видно без прокрутки. Гарантия тач-цели никуда не делась, она переехала
    // в @media (pointer: coarse) на класс sidebar-nav-item (см. index.css),
    // поэтому проверяем наличие класса-крючка, а не жёсткую высоту.
    expect(currentLink).toHaveClass("sidebar-nav-item", "focus-visible:ring-2");
    expect(screen.getByRole("link", { name: "PRODENT" })).toHaveClass(
      "min-h-11",
      "min-w-11",
      "focus-visible:ring-2",
    );
  });

  it("keeps the mobile drawer within narrow viewports", () => {
    renderSidebar();

    expect(screen.getByTestId("role-sidebar-mobile")).toHaveClass(
      "h-dvh",
      "w-64",
      "max-w-[calc(100vw-4rem)]",
    );
  });

  it("does not render sidebar labels below the 12px product minimum", () => {
    renderSidebar();

    // Проверяем ПОРОГ, а не конкретное имя класса: разрешены только те токены
    // размера, что дают 12px и больше. Раньше здесь стояло жёсткое "text-xs",
    // и подпись, поднятая до 12.5px (text-meta), роняла тест, хотя правило
    // «не мельче 12px» соблюдалось. Мельчить по-прежнему нельзя — класса
    // меньше 12px в списке просто нет.
    const ALLOWED = ["text-xs", "text-meta", "text-cell", "text-sm", "text-base"];
    const atLeast12px = (element: HTMLElement, what: string) => {
      const has = ALLOWED.some((token) => element.classList.contains(token));
      expect(has, `${what}: ${element.className} — размер мельче 12px или не из шкалы`).toBe(true);
    };

    atLeast12px(screen.getAllByText("ID 100")[0], "номер счёта");
    atLeast12px(screen.getAllByText("Врач")[0], "роль");
    atLeast12px(screen.getAllByText("3")[0], "счётчик");
  });
});

describe("RoleLayoutShell mobile content offset", () => {
  it("reserves toolbar space on mobile and removes it on desktop", () => {
    render(
      <RoleLayoutShell sidebar={<nav>Меню</nav>}>
        <h1>Кабинет</h1>
      </RoleLayoutShell>,
    );

    expect(screen.getByRole("main")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "pt-16",
      "lg:pt-0",
      "lg:pl-64",
    );
    expect(screen.getByRole("main").parentElement).toHaveClass(
      "w-full",
      "max-w-full",
      "overflow-x-clip",
    );
  });
});
