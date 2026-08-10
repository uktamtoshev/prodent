// Single source of truth for the standalone marketplace's paths.
//
// Today the market is a sub-route of the main SPA, mounted at `/market`. When it
// later moves to its own subdomain (market.prodent.uz) it will be mounted at the
// root ("/"). All in-market navigation goes through `marketPath()`, so that move
// is a one-line change here (MARKET_BASE = "") rather than a sweep across files.

export const MARKET_BASE = "/market";

/** Build an in-market path, e.g. marketPath("cart") -> "/market/cart". */
export const marketPath = (sub = ""): string => {
  const clean = sub.replace(/^\/+/, "");
  if (!MARKET_BASE) return clean ? `/${clean}` : "/";
  return clean ? `${MARKET_BASE}/${clean}` : MARKET_BASE;
};

export const MARKET_ROUTES = {
  catalog: () => marketPath(),
  cart: () => marketPath("cart"),
  orders: () => marketPath("orders"),
  product: (id: string) => marketPath(`product/${id}`),
  supplier: (id: string) => marketPath(`supplier/${id}`),
};

/** Where the "Кабинет врача" button returns to. */
export const CABINET_HOME = "/doctor";
