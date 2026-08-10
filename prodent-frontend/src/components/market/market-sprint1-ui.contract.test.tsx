import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketProduct } from "@/contexts/MarketCartContext";
import { ProductCard } from "./ProductCard";
import { MarketToolbar } from "./MarketToolbar";

const { setQty, qtyOf } = vi.hoisted(() => ({
  setQty: vi.fn(),
  qtyOf: vi.fn<() => number>(),
}));

vi.mock("@/contexts/MarketCartContext", () => ({
  useMarketCart: () => ({ qtyOf, setQty }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "ru",
    t: (key: string) =>
      ({
        "market.product": "Товар",
        "market.service": "Услуга",
        "market.currencyUzs": "сум",
        "market.unitPiece": "шт",
        "market.outOfStock": "Нет в наличии",
        "market.addToCart": "В корзину",
        "market.decreaseQuantity": "Уменьшить количество",
        "market.increaseQuantity": "Увеличить количество",
        "market.searchPlaceholder": "Поиск",
        "market.sortLabel": "Сортировка",
        "market.sortNew": "Сначала новые",
        "market.sortCheap": "Сначала дешёвые",
        "market.sortExpensive": "Сначала дорогие",
        "market.sortName": "По названию",
        "market.inStock": "В наличии",
        "market.found": "Найдено",
      })[key] || key,
  }),
}));

const files = [
  "src/pages/market/MarketOrders.tsx",
  "src/pages/market/MarketProductDetail.tsx",
  "src/pages/market/MarketCart.tsx",
  "src/pages/market/MarketCatalog.tsx",
  "src/pages/market/MarketSupplierProfile.tsx",
  "src/components/market/ProductCard.tsx",
  "src/components/market/ProductRibbon.tsx",
  "src/components/market/SupplierReviews.tsx",
] as const;

const shellFiles = [
  "src/components/market/MarketToolbar.tsx",
  "src/components/market/MarketLayout.tsx",
] as const;

const source = (file: (typeof files)[number] | (typeof shellFiles)[number]) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

const product: MarketProduct = {
  id: "product-1",
  supplier_id: "supplier-1",
  type: "product",
  name: "Стоматологическое кресло",
  description: null,
  category: "Оборудование",
  brand: "Prodent",
  unit: "шт",
  price: 1200000,
  currency: "UZS",
  stock_quantity: 5,
  image_url: null,
};

describe("marketplace Sprint 1 UI contract", () => {
  beforeEach(() => {
    setQty.mockReset();
    qtyOf.mockReset();
    qtyOf.mockReturnValue(0);
  });

  it.each(files)("%s keeps visible text at 12px or larger", (file) => {
    expect(source(file)).not.toMatch(
      /text-\[(?:[0-9](?:\.\d+)?|1[01](?:\.\d+)?)px\]/,
    );
  });

  it.each(files)("%s uses semantic theme tokens", (file) => {
    expect(source(file), file).not.toMatch(fixedPaletteClass);
  });

  it.each(shellFiles)("%s keeps the market shell semantic and touchable", (file) => {
    const component = source(file);
    expect(component, file).not.toMatch(fixedPaletteClass);
    expect(component, file).not.toMatch(/\bh-10\b/);
    expect(component, file).not.toMatch(
      /text-\[(?:[0-9](?:\.\d+)?|1[01](?:\.\d+)?)px\]/,
    );
    expect(component, file).toContain("focus-visible:ring-2");
  });

  it("keeps the toolbar inside narrow mobile viewports", () => {
    const toolbar = source(shellFiles[0]);
    expect(toolbar).toContain("w-full min-w-0");
    expect(toolbar).toContain("w-full sm:w-auto");
    expect(toolbar).toContain("flex w-full min-w-0");
    expect(toolbar).toContain("sm:w-24");
  });

  it("marks active shell navigation and loading state accessibly", () => {
    const layout = source(shellFiles[1]);
    expect(layout).toContain('aria-current={active ? "page" : undefined}');
    expect(layout).toContain('aria-label="Разделы магазина"');
    expect(layout).toContain('role="status"');
    expect(layout).toContain('aria-live="polite"');
  });

  it("keeps marketplace actions touchable and keyboard-visible", () => {
    const all = files.map(source).join("\n");
    expect(all).toContain("h-11");
    expect(all).toContain("focus-visible:ring-2");
    expect(all).toContain('type="button"');
  });

  it("keeps marketplace routes behind the shared route helpers", () => {
    for (const file of files) {
      expect(source(file), file).not.toMatch(/(?:to|navigate)\s*=\s*["'`]\/market/);
    }
    expect(source(files[3])).toContain("MARKET_ROUTES.cart()");
    expect(source(files[4])).toContain("MARKET_ROUTES.cart()");
  });

  it("does not apply page-local catalog facets or sorting", () => {
    const catalog = source(files[3]);
    expect(catalog).not.toContain("sortProducts(");
    expect(catalog).not.toContain("isOutOfStock(");
    expect(catalog).not.toContain("categories.map");
    expect(catalog).not.toContain("filtered.map");
    expect(catalog).toContain('sortKeys={["new", "cheap", "expensive"]}');
    expect(catalog).toContain("showInStock={false}");
    expect(catalog).toContain('aria-label="Страницы каталога"');
  });

  it("exposes loading, error, empty and accessible order confirmation states", () => {
    const pages = files.slice(0, 5).map(source).join("\n");
    expect(pages).toContain('role="status"');
    expect(pages).toContain('role="alert"');
    expect(pages).toContain('role="dialog"');
    expect(pages).toContain('event.key === "Escape"');
    expect(pages).toContain("requestAnimationFrame");
  });

  it("adds a product through the shared product card", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ProductCard product={product} supplierName="Поставщик" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "В корзину" }));
    expect(setQty).toHaveBeenCalledWith(product, 1);
  });

  it("changes quantity through labelled 44px controls", async () => {
    qtyOf.mockReturnValue(2);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    );

    const decrease = screen.getByRole("button", {
      name: `Уменьшить количество: ${product.name}`,
    });
    const increase = screen.getByRole("button", {
      name: `Увеличить количество: ${product.name}`,
    });
    expect(decrease).toHaveClass("h-11", "w-11");
    expect(increase).toHaveClass("h-11", "w-11");

    await user.click(decrease);
    await user.click(increase);
    expect(setQty).toHaveBeenNthCalledWith(1, product, 1);
    expect(setQty).toHaveBeenNthCalledWith(2, product, 3);
  });

  it("offers only server-supported catalog controls", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();
    render(
      <MarketToolbar
        query=""
        onQuery={vi.fn()}
        sort="new"
        onSort={onSort}
        sortKeys={["new", "cheap", "expensive"]}
        showInStock={false}
        inStockOnly={false}
        onToggleStock={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Сортировка" });
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.queryByRole("option", { name: "По названию" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "В наличии" })).not.toBeInTheDocument();

    await user.selectOptions(select, "cheap");
    expect(onSort).toHaveBeenCalledWith("cheap");
  });

  it("keeps every visible toolbar control 44px tall and interactive", async () => {
    const onQuery = vi.fn();
    const onToggleStock = vi.fn();
    const onMinPrice = vi.fn();
    const onMaxPrice = vi.fn();
    const user = userEvent.setup();
    render(
      <MarketToolbar
        query=""
        onQuery={onQuery}
        sort="new"
        onSort={vi.fn()}
        inStockOnly={false}
        onToggleStock={onToggleStock}
        minPrice=""
        maxPrice=""
        onMinPrice={onMinPrice}
        onMaxPrice={onMaxPrice}
      />,
    );

    const search = screen.getByRole("searchbox", { name: "Поиск" });
    const sort = screen.getByRole("combobox", { name: "Сортировка" });
    const minimum = screen.getByRole("spinbutton", { name: "market.priceFrom" });
    const maximum = screen.getByRole("spinbutton", { name: "market.priceTo" });
    const stock = screen.getByRole("button", { name: "В наличии" });

    for (const control of [search, sort, minimum, maximum, stock]) {
      expect(control).toHaveClass("h-11");
    }

    await user.type(search, "цемент");
    await user.click(stock);
    expect(onQuery).toHaveBeenCalled();
    expect(onToggleStock).toHaveBeenCalledTimes(1);
  });
});
