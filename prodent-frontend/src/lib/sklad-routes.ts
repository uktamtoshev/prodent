// Single source of truth for the Склад module's paths.
//
// The shared SPA always keeps Склад under its own prefix. This remains true
// on sklad.prodent.uz because the application also owns the public `/` route.
// A host-level redirect may lead visitors from `/` to this collision-free path.
export const SKLAD_BASE = "/sklad";

/** Build an in-module path, e.g. skladPath("transactions") -> "/sklad/transactions". */
export const skladPath = (sub = ""): string => {
  const clean = sub.replace(/^\/+/, "");
  return clean ? `${SKLAD_BASE}/${clean}` : SKLAD_BASE;
};

export const SKLAD_ROUTES = {
  items: () => skladPath(),
  transactions: () => skladPath("transactions"),
  categories: () => skladPath("categories"),
  suppliers: () => skladPath("suppliers"),
};

/** Where the "Кабинет" button returns to. */
export const CABINET_HOME = "/crm";
