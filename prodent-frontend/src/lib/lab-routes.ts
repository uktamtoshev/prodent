// Single source of truth for the Лаборатория (Laboratory) module's paths.
//
// The shared SPA always keeps Лаборатория under its own prefix. This
// remains true on lab.prodent.uz because the application also owns the public
// `/` route. A host-level redirect may lead visitors to this collision-free path.
export const LAB_BASE = "/lab";

/** Build an in-module path, e.g. labPath("labs") -> "/lab/labs". */
export const labPath = (sub = ""): string => {
  const clean = sub.replace(/^\/+/, "");
  return clean ? `${LAB_BASE}/${clean}` : LAB_BASE;
};

export const LAB_ROUTES = {
  // Заказы — the customer order panel (list / create / track / chat).
  orders: () => labPath(),
  // Лаборатории — catalog of technicians/labs + their price lists.
  labs: () => labPath("labs"),
  // Расчёты — the customer's settlements & debts on their orders.
  finance: () => labPath("finance"),
};

/** Where the "Кабинет" button returns to. */
export const CABINET_HOME = "/crm";
