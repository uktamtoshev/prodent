import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  InventoryCountDialog,
  ItemDialog,
  StockDialog,
  TransferDialog,
} from "./SkladShared";

vi.mock("@/contexts/LanguageContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/contexts/LanguageContext")>();
  return {
    ...actual,
    useLanguage: () => ({
      language: "ru",
      t: (key: string) => key,
    }),
  };
});

vi.mock("@/lib/sklad", () => ({
  sklad: {
    listCategories: vi.fn().mockResolvedValue([]),
    listSuppliers: vi.fn().mockResolvedValue([]),
  },
}));

const item = {
  id: "item-1",
  name: "Composite",
  unit: "шт",
  quantity: 3,
  min_quantity: 1,
  location: "A1",
};

describe("SkladShared accessibility", () => {
  it("labels every item field", () => {
    render(
      <ItemDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );

    for (const label of [
      "itemName", "category", "supplier", "openingStock", "minimumStock",
      "unit", "pricePerUnit", "expiryDate", "brand", "sku", "location",
      "notes",
    ]) {
      expect(screen.getByLabelText(`sklad.dialogs.${label}`)).toBeInTheDocument();
    }
  });

  it("labels stock movement fields including income and appointment variants", () => {
    const { rerender } = render(
      <StockDialog
        open
        onOpenChange={vi.fn()}
        onDone={vi.fn()}
        type="income"
        items={[item] as never}
      />,
    );

    for (const label of ["item", "quantity", "batchNumber", "batchExpiry", "reason"]) {
      expect(screen.getByLabelText(`sklad.dialogs.${label}`)).toBeInTheDocument();
    }

    rerender(
      <StockDialog
        open
        onOpenChange={vi.fn()}
        onDone={vi.fn()}
        type="expense"
        items={[item] as never}
      />,
    );
    expect(screen.getByLabelText("sklad.dialogs.appointmentOptional")).toBeInTheDocument();
  });

  it("labels every transfer field", () => {
    render(
      <TransferDialog
        open
        onOpenChange={vi.fn()}
        onDone={vi.fn()}
        items={[item] as never}
      />,
    );

    for (const label of ["source", "destination", "quantity", "comment"]) {
      expect(screen.getByLabelText(`sklad.dialogs.${label}`)).toBeInTheDocument();
    }
  });

  it("labels every inventory count field", () => {
    render(
      <InventoryCountDialog
        open
        onOpenChange={vi.fn()}
        onDone={vi.fn()}
        items={[item] as never}
      />,
    );

    for (const label of ["item", "actualStock", "note"]) {
      expect(screen.getByLabelText(`sklad.dialogs.${label}`)).toBeInTheDocument();
    }
  });
});
