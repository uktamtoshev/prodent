import { type MarketProduct } from "@/contexts/MarketCartContext";

// Shared catalog sort/filter helpers — used by the catalog and the supplier page.
export type SortKey = "new" | "cheap" | "expensive" | "name";

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "new", label: "Сначала новые" },
  { key: "cheap", label: "Сначала дешёвые" },
  { key: "expensive", label: "Сначала дорогие" },
  { key: "name", label: "По названию (А–Я)" },
];

export const isOutOfStock = (p: MarketProduct) =>
  p.type === "product" && p.stock_quantity != null && p.stock_quantity <= 0;

/** Sort a copy of `list` by the given key. "new" preserves the incoming order. */
export function sortProducts<T extends MarketProduct>(list: T[], sort: SortKey): T[] {
  const out = [...list];
  if (sort === "cheap") out.sort((a, b) => a.price - b.price);
  else if (sort === "expensive") out.sort((a, b) => b.price - a.price);
  else if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return out;
}
