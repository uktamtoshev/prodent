import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataTable, type DataTableColumn } from "./DataTable";

interface Row { id: string; name: string }
const rows: Row[] = [{ id: "1", name: "Анна" }, { id: "2", name: "Борис" }, { id: "3", name: "Вера" }];
const columns: DataTableColumn<Row>[] = [{ id: "name", header: "Имя", cell: (row) => row.name }];

describe("DataTable", () => {
  it("slices rows only for explicit client pagination", () => {
    render(<DataTable rows={rows} columns={columns} getRowId={(row) => row.id} pagination={{ mode: "client", page: 2, pageSize: 2, onPageChange: vi.fn() }} caption="Пациенты" />);
    expect(screen.getByText("Вера")).toBeInTheDocument();
    expect(screen.queryByText("Анна")).not.toBeInTheDocument();
  });

  it("guards against a zero page size", () => {
    render(<DataTable rows={rows} columns={columns} getRowId={(row) => row.id} pagination={{ mode: "client", page: 1, pageSize: 0, onPageChange: vi.fn() }} />);
    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.queryByText("Борис")).not.toBeInTheDocument();
  });

  it("does not slice server rows and requests the next page", async () => {
    const onPageChange = vi.fn();
    render(<DataTable rows={rows.slice(0, 2)} columns={columns} getRowId={(row) => row.id} pagination={{ mode: "server", page: 1, pageSize: 2, totalRows: 5, onPageChange }} />);
    expect(screen.getByText("Анна")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("uses the mobile row render hook", () => {
    render(<DataTable rows={rows.slice(0, 1)} columns={columns} getRowId={(row) => row.id} caption="Пациенты" renderMobileRow={(row) => <article>Карточка {row.name}</article>} />);
    expect(screen.getByText("Карточка Анна")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Пациенты" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  it("names the scrollable table region and exposes the current page", () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Пациенты"
        pagination={{ mode: "client", page: 1, pageSize: 2, onPageChange: vi.fn() }}
      />,
    );

    expect(screen.getByRole("region", { name: "Пациенты" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table", { name: "Пациенты" })).toBeInTheDocument();
    expect(screen.getByText("Страница 1 из 2")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Предыдущая страница" })).toHaveClass("h-prodent-btn", "w-prodent-btn");
  });
});
