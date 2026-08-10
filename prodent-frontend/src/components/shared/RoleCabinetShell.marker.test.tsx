import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoleCabinetShell } from "./RoleCabinetShell";

/**
 * Признак кабинета на <html>.
 *
 * Он существует ровно по одной причине: Radix (Dialog, Sheet, Select, Popover,
 * DropdownMenu) рендерит содержимое порталом в document.body — мимо оболочки
 * кабинета. Правила оформления, привязанные к самой оболочке, до модалок не
 * достают, и модалка выглядит иначе, чем страница под ней.
 *
 * Здесь закреплено и то, что признак СНИМАЕТСЯ: если он останется висеть после
 * выхода из кабинета, оформление кабинета протечёт на лендинг и в кабинет
 * пациента.
 */
describe("RoleCabinetShell · признак кабинета", () => {
  const renderShell = () =>
    render(
      <RoleCabinetShell sidebar={<nav aria-label="Кабинет">Меню</nav>}>
        <h1>Расписание</h1>
      </RoleCabinetShell>,
    );

  it("ставит признак на корень документа, пока кабинет открыт", () => {
    const { unmount } = renderShell();

    expect(document.documentElement.hasAttribute("data-cabinet")).toBe(true);

    unmount();
  });

  it("снимает признак при выходе из кабинета", () => {
    const { unmount } = renderShell();
    unmount();

    expect(document.documentElement.hasAttribute("data-cabinet")).toBe(false);
  });

  it("не теряет признак, пока открыта хотя бы одна оболочка", () => {
    // Так ведёт себя переход между кабинетами: новая оболочка монтируется
    // раньше, чем размонтируется старая. Уборка старой не должна снимать
    // признак, который уже нужен новой.
    const first = renderShell();
    const second = renderShell();

    first.unmount();
    expect(document.documentElement.hasAttribute("data-cabinet")).toBe(true);

    second.unmount();
    expect(document.documentElement.hasAttribute("data-cabinet")).toBe(false);
  });
});
