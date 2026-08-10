import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";

// A marketplace catalog item. Kept here (not imported from a page) so every
// market screen and the cart share one shape. The cart stores a snapshot of the
// product for display only — the authoritative price is recomputed server-side
// in MarketplaceController on placeOrder.
export interface MarketProduct {
  id: string;
  supplier_id: string;
  type: "product" | "service";
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  unit: string | null;
  price: number;
  currency: string;
  stock_quantity: number | null;
  image_url: string | null;
}

export interface CartLine {
  product: MarketProduct;
  qty: number;
}

interface MarketCartValue {
  items: CartLine[];
  count: number;
  total: number;
  qtyOf: (productId: string) => number;
  setQty: (product: MarketProduct, qty: number) => void;
  add: (product: MarketProduct) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const MarketCartContext = createContext<MarketCartValue | null>(null);

const keyFor = (userId: string | undefined) => `prodent_market_cart_${userId || "anon"}`;

function readCart(storageKey: string): Record<string, CartLine> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Record<string, CartLine>) : {};
  } catch {
    return {};
  }
}

/**
 * Cart state for the standalone marketplace, persisted to localStorage so it
 * survives navigation between Каталог / Корзина / Мои заказы (and page reloads).
 * Keyed per user, so switching accounts doesn't leak a cart.
 */
export function MarketCartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = keyFor(user?.id);

  const [lines, setLines] = useState<Record<string, CartLine>>(() => readCart(keyFor(user?.id)));

  // When the active user (storage key) changes, load that user's cart. The
  // skipPersist guard stops the persist effect below from immediately writing
  // back stale state before this load lands.
  const skipPersist = useRef(true);
  useEffect(() => {
    setLines(readCart(storageKey));
    skipPersist.current = true;
  }, [storageKey]);

  // Persist on every change, except the render right after a (re)load.
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [storageKey, lines]);

  const setQty = useCallback((product: MarketProduct, qty: number) => {
    setLines((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[product.id];
      else next[product.id] = { product, qty };
      return next;
    });
  }, []);

  const add = useCallback((product: MarketProduct) => {
    setLines((prev) => {
      const cur = prev[product.id]?.qty || 0;
      return { ...prev, [product.id]: { product, qty: cur + 1 } };
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const clear = useCallback(() => setLines({}), []);

  const value = useMemo<MarketCartValue>(() => {
    const items = Object.values(lines);
    return {
      items,
      count: items.reduce((s, x) => s + x.qty, 0),
      total: items.reduce((s, x) => s + x.qty * x.product.price, 0),
      qtyOf: (productId: string) => lines[productId]?.qty || 0,
      setQty,
      add,
      remove,
      clear,
    };
  }, [lines, setQty, add, remove, clear]);

  return <MarketCartContext.Provider value={value}>{children}</MarketCartContext.Provider>;
}

export function useMarketCart(): MarketCartValue {
  const ctx = useContext(MarketCartContext);
  if (!ctx) throw new Error("useMarketCart must be used within MarketCartProvider");
  return ctx;
}
