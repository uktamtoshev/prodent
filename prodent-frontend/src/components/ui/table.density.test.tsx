import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

/**
 * Плотность таблицы из макета.
 *
 * До этого высота строки не была задана вовсе — её определяло содержимое, и
 * замер живьём давал 46.5px на расписании против 70.1px на услугах. Один и тот
 * же список выглядел по-разному на соседних экранах.
 *
 * Числа заведены токенами (h-row, h-row-head, px-card-x, text-cell), а не
 * записями вида h-[42px]: контракт cabinet-design-debt держит потолок на
 * произвольные размеры, и запас там исчерпан.
 *
 * ВАЖНО: значения по умолчанию стоят ПЕРВЫМ аргументом cn, поэтому точечный
 * класс экрана по-прежнему побеждает. Это проверяется последним тестом —
 * иначе примитив отобрал бы у экранов возможность отступить от плотности там,
 * где это осознанно нужно.
 */
describe("плотность таблицы", () => {
  const renderTable = (cellClass?: string) =>
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Пациент</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className={cellClass}>Иванов</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

  it("держит строку на высоте макета и отступ только по горизонтали", () => {
    renderTable();

    const cell = screen.getByText("Иванов");
    expect(cell).toHaveClass("h-row", "px-card-x", "py-0");
  });

  it("рисует шапку ниже строки и на собственной поверхности", () => {
    renderTable();

    const head = screen.getByText("Пациент");
    // 36px против 42px у строки: шапка должна быть компактнее содержимого.
    expect(head).toHaveClass("h-row-head", "bg-surface-2", "px-card-x");
    // 12px/600 — в макете шапка НЕ прописная, вес отличает её от строк.
    expect(head).toHaveClass("text-xs", "font-semibold");
    expect(head.className).not.toContain("uppercase");
  });

  it("задаёт рабочий размер текста таблицы", () => {
    const { container } = renderTable();

    expect(container.querySelector("table")).toHaveClass("text-cell");
  });

  it("оставляет экрану право переопределить плотность", () => {
    renderTable("h-auto py-4");

    const cell = screen.getByText("Иванов");
    // Оба класса присутствуют: побеждает тот, что пришёл от экрана (tailwind-merge
    // разрешает конфликт в пользу последнего). Проверяем, что примитив не
    // выкинул пользовательский класс.
    expect(cell.className).toContain("py-4");
    expect(cell.className).toContain("h-auto");
  });
});
