import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoleCabinetShell } from "./RoleCabinetShell";
import { writeWorkspaceBackground } from "@/lib/workspace-background";

/**
 * Обои рабочего пространства — необязательное оформление. Главное, что здесь
 * закреплено: пока пользователь ничего не выбрал, в разметке НЕТ ни слоя обоев,
 * ни следов настройки. Кабинет должен выглядеть ровно как до её появления.
 */
describe("RoleCabinetShell · обои рабочего пространства", () => {
  afterEach(() => {
    window.localStorage.removeItem("prodent_workspace_background");
  });

  const renderShell = () =>
    render(
      <RoleCabinetShell sidebar={<nav aria-label="Кабинет">Меню</nav>}>
        <h1>Расписание</h1>
      </RoleCabinetShell>,
    );

  it("по умолчанию не добавляет слой обоев", () => {
    const { container } = renderShell();

    expect(container.querySelector(".workspace-wallpaper")).toBeNull();
    expect(screen.getByRole("main").parentElement).toHaveAttribute(
      "data-workspace-bg",
      "none",
    );
  });

  it.each(["aurora", "sky"] as const)("рисует слой обоев для варианта %s", (choice) => {
    writeWorkspaceBackground(choice);

    const { container } = renderShell();
    const layer = container.querySelector(".workspace-wallpaper");

    expect(layer).not.toBeNull();
    // Слой лежит под содержимым и не перехватывает клики.
    expect(layer).toHaveClass("pointer-events-none", "absolute", "inset-0");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("main").parentElement).toHaveAttribute(
      "data-workspace-bg",
      choice,
    );
  });

  it("оставляет слой сестрой main, иначе абсолютный фон закроет содержимое", () => {
    writeWorkspaceBackground("aurora");

    const { container } = renderShell();
    const layer = container.querySelector(".workspace-wallpaper");
    const main = screen.getByRole("main");

    // Слой и main — дети одного контейнера, и оба позиционированы:
    // порядок отрисовки задаёт DOM, поэтому содержимое остаётся сверху.
    expect(layer?.parentElement).toBe(main.parentElement);
    expect(main).toHaveClass("relative");
    expect(main.parentElement).toHaveClass("relative");
  });

  it("не ломает прежний контракт оболочки", () => {
    writeWorkspaceBackground("sky");
    renderShell();

    expect(screen.getByRole("main")).toHaveClass("min-w-0", "max-w-full", "lg:pl-64");
    expect(screen.getByRole("main").parentElement).toHaveClass(
      "w-full",
      "max-w-full",
      "overflow-x-clip",
    );
    expect(screen.getByRole("navigation", { name: "Кабинет" })).toBeInTheDocument();
  });
});
