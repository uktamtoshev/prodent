import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "./SellerProducts";

const files = [
  "src/pages/seller/SellerWarehouse.tsx",
  "src/pages/seller/SellerProducts.tsx",
  "src/pages/seller/SellerOrders.tsx",
] as const;

const source = (file: (typeof files)[number]) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("seller operations UI foundation contract", () => {
  it.each(files)("%s uses semantic theme tokens", (file) => {
    expect(source(file)).not.toMatch(fixedPaletteClass);
  });

  it.each(files)("%s keeps visible text at least 12px", (file) => {
    expect(source(file)).not.toMatch(/text-\[(?:[0-9](?:\.\d+)?|1[01](?:\.\d+)?)px\]/);
  });

  it.each(files)("%s exposes accessible async states", (file) => {
    const page = source(file);
    expect(page).toContain('role="status"');
    expect(page).toContain('role="alert"');
    expect(page).toContain("aria-live");
  });

  it("keeps warehouse and product tables keyboard discoverable", () => {
    expect(source(files[0])).toContain('aria-label="Таблица склада"');
    expect(source(files[0])).toContain("tabIndex={0}");
    expect(source(files[1])).toContain('aria-label="Таблица товаров"');
    expect(source(files[1])).toContain("tabIndex={0}");
  });

  it("uses labelled modal dialogs and 44px compact controls", () => {
    const pages = files.map(source).join("\n");
    expect(pages).toContain('aria-modal="true"');
    expect(pages).toContain('aria-describedby="seller-product-dialog-description"');
    expect(pages).toContain('aria-describedby="reject-order-description"');
    expect(pages).toContain("h-11 w-11");
    expect(pages).toContain("focus-visible:ring-2");
  });

  it("exposes the combobox list and supports keyboard selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(createElement(Combobox, {
      value: "",
      onChange,
      options: ["Анестезия", "Оборудование"],
      placeholder: "Категория",
    }));

    const input = screen.getByRole("combobox");
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(2);

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("Оборудование");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the combobox with Escape", async () => {
    const user = userEvent.setup();
    render(createElement(Combobox, {
      value: "",
      onChange: vi.fn(),
      options: ["Анестезия"],
    }));

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("traps dialog focus and restores the element that opened it", () => {
    for (const file of [files[0], files[2]]) {
      const page = source(file);
      expect(page).toContain('event.key !== "Tab"');
      expect(page).toContain("previousFocus");
      expect(page).toContain("previousFocus.focus()");
      expect(page).toContain("last.focus()");
      expect(page).toContain("first.focus()");
      expect(page).toContain("ref={");
      expect(page).toContain("tabIndex={-1}");
    }
  });

  it("uses maintained cards instead of the legacy design layer", () => {
    expect(source(files[1])).not.toContain('from "@/components/design"');
    expect(source(files[2])).not.toContain('from "@/components/design"');
  });
});
