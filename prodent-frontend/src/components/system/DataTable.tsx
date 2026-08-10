import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useSystemLabel } from "./system-labels";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

export type DataTablePagination =
  | { mode: "client"; page: number; pageSize: number; onPageChange: (page: number) => void }
  | { mode: "server"; page: number; pageSize: number; totalRows: number; onPageChange: (page: number) => void };

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  pagination?: DataTablePagination;
  renderMobileRow?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  caption?: string;
  mobileListLabel?: string;
  className?: string;
  /**
   * Max height for the scroll area, e.g. `"max-h-cabinet"`. Setting it makes
   * the header row stick.
   *
   * Not a table in the cabinet had a sticky header: on a 40-appointment day the
   * administrator scrolled the column titles away and then could not tell which
   * column held the room and which the chair.
   */
  maxHeightClassName?: string;
  /** Compact row height for dense work screens (40px instead of the default). */
  dense?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  pagination,
  renderMobileRow,
  emptyState,
  caption,
  mobileListLabel,
  className,
  maxHeightClassName,
  dense,
}: DataTableProps<T>) {
  const label = useSystemLabel();
  const resolvedEmptyState = emptyState ?? label("noData");
  const pageSize = pagination ? Math.max(1, pagination.pageSize) : 1;
  const totalRows = pagination?.mode === "server" ? Math.max(0, pagination.totalRows) : rows.length;
  const pageCount = pagination ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
  const page = pagination ? Math.min(Math.max(1, pagination.page), pageCount) : 1;
  const visibleRows =
    pagination?.mode === "client" ? rows.slice((page - 1) * pageSize, page * pageSize) : rows;
  const changePage = (next: number) => pagination?.onPageChange(Math.min(Math.max(1, next), pageCount));

  return (
    <section className={cn("space-y-3", className)}>
      {renderMobileRow ? (
        <div
          className="space-y-3 md:hidden"
          role="list"
          aria-label={mobileListLabel ?? caption ?? label("data")}
        >
          {visibleRows.length
            ? visibleRows.map((row) => (
                <div key={getRowId(row)} role="listitem">
                  {renderMobileRow(row)}
                </div>
              ))
            : <div role="status">{resolvedEmptyState}</div>}
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-full rounded-xl border border-border",
          // `overflow-hidden` would clip a sticky header out of existence, so
          // the scroll container only clips when it is not the scroll parent.
          maxHeightClassName ? cn("overflow-y-auto", maxHeightClassName) : "overflow-hidden",
          renderMobileRow && "hidden md:block",
        )}
      >
        <Table
          aria-label={caption ?? label("dataTable")}
          containerLabel={caption ?? label("scrollableTable")}
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader className={maxHeightClassName ? "sticky top-0 z-10 bg-card" : undefined}>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  scope="col"
                  className={cn(dense && "h-9 py-0", column.className)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length ? visibleRows.map((row) => (
              <TableRow key={getRowId(row)} className={dense ? "h-10" : undefined}>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(dense && "py-1", column.className)}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">{resolvedEmptyState}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination ? (
        <nav
          aria-label={label("pagination")}
          className="flex flex-wrap items-center justify-between gap-2 sm:justify-end"
        >
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {label("pageOf", { page, pageCount })}
          </span>
          <Button type="button" size="icon" variant="outline" aria-label={label("prevPage")} disabled={page <= 1} onClick={() => changePage(page - 1)}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" aria-label={label("nextPage")} disabled={page >= pageCount} onClick={() => changePage(page + 1)}>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
