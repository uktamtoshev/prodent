import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import { DoctorTopbar } from "@/components/doctor/DoctorTopbar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { marketplace } from "@/lib/marketplace";

interface Supplier {
  id: string;
  name: string;
  city: string | null;
  is_verified: boolean;
}
interface Product {
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

const fmt = (n: number) => Number(n).toLocaleString("ru-RU");

export default function DoctorMarket() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, Supplier>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Все");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [pRes, sRes] = await Promise.all([
        supabase.from("marketplace_products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("marketplace_suppliers").select("id,name,city,is_verified").eq("is_active", true),
      ]);
      if (pRes.error) toast.error("Не удалось загрузить каталог");
      setProducts((pRes.data as Product[]) || []);
      const map: Record<string, Supplier> = {};
      ((sRes.data as Supplier[]) || []).forEach((s) => (map[s.id] = s));
      setSuppliers(map);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return ["Все", ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return products.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false) ||
        (suppliers[p.supplier_id]?.name.toLowerCase().includes(q) ?? false);
      const matchCat = category === "Все" || p.category === category;
      return matchQ && matchCat;
    });
  }, [products, query, category, suppliers]);

  const cartItems = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty })).filter((x) => x.product),
    [cart, products]
  );
  const cartCount = cartItems.reduce((s, x) => s + x.qty, 0);
  const cartTotal = cartItems.reduce((s, x) => s + x.qty * x.product.price, 0);

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  return (
    <DoctorLayout>
      <DoctorTopbar
        title="Маркетплейс"
        subtitle="Каталог поставщиков · прозрачные цены и онлайн-заказ"
        right={
          <button
            onClick={() => cartCount > 0 && setCheckout(true)}
            className="relative inline-flex h-10 items-center gap-2 rounded-prodent-input border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            <ShoppingCart className="h-4 w-4" />
            Корзина
            {cartCount > 0 && (
              <span className="ml-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-xs font-bold text-white tabular-nums">
                {cartCount}
              </span>
            )}
          </button>
        }
      />

      <div className="space-y-4 px-6 py-6 lg:px-8 pb-28">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по товарам, брендам, поставщикам…"
              className="h-10 w-full rounded-prodent-input border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-[hsl(var(--brand))] focus:ring-2 focus:ring-[hsl(var(--brand-100))]"
            />
          </div>
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "h-8 rounded-prodent-input px-3 text-xs font-medium transition",
                  c === category
                    ? "bg-primary/10 text-primary ring-1 ring-[hsl(var(--brand-100))]"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-prodent border border-dashed border-border bg-card px-6 py-20 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <div className="text-base font-semibold text-foreground">
              {products.length === 0 ? "Каталог пока пуст" : "Ничего не найдено"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {products.length === 0 ? "Поставщики ещё не добавили товары" : "Измените запрос или категорию"}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const sup = suppliers[p.supplier_id];
              const inCart = cart[p.id] || 0;
              const outOfStock = p.type === "product" && p.stock_quantity != null && p.stock_quantity <= 0;
              return (
                <div key={p.id} className="flex flex-col overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-6px_rgba(15,23,42,0.06)]">
                  <div className="aspect-[4/3] bg-muted grid place-items-center overflow-hidden text-slate-300">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-10 w-10" />}
                  </div>
                  <div className="flex flex-1 flex-col p-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Store className="h-3 w-3" />
                      <span className="truncate">{sup?.name || "Поставщик"}</span>
                      {sup?.is_verified && <ShieldCheck className="h-3 w-3 text-emerald-500" />}
                    </div>
                    <div className="mt-1 text-base font-semibold leading-snug text-foreground line-clamp-2">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p.type === "service" ? "Услуга" : p.category || "Товар"}
                    </div>
                    <div className="mt-auto pt-3">
                      <div className="text-lg font-bold tabular-nums text-foreground">
                        {fmt(p.price)} <span className="text-xs font-normal text-muted-foreground">{p.currency === "UZS" ? "сум" : p.currency}/{p.unit || "шт"}</span>
                      </div>
                      {outOfStock ? (
                        <div className="mt-2 text-xs font-medium text-rose-600">Нет в наличии</div>
                      ) : inCart > 0 ? (
                        <div className="mt-2 flex items-center gap-2">
                          <button onClick={() => setQty(p.id, inCart - 1)} className="grid h-8 w-8 place-items-center rounded-[8px] border border-border text-muted-foreground hover:bg-muted/50">
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[28px] text-center text-base font-semibold tabular-nums">{inCart}</span>
                          <button onClick={() => setQty(p.id, inCart + 1)} className="grid h-8 w-8 place-items-center rounded-[8px] border border-border text-muted-foreground hover:bg-muted/50">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setQty(p.id, 1)}
                          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-prodent-input bg-primary text-sm font-semibold text-white hover:brightness-110"
                        >
                          <Plus className="h-4 w-4" /> В корзину
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart summary bar */}
      {cartCount > 0 && !checkout && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:left-[calc(50%+128px)]">
          <button
            onClick={() => setCheckout(true)}
            className="inline-flex items-center gap-3 rounded-full bg-primary py-3 pl-5 pr-4 text-white shadow-lg hover:brightness-110"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm font-semibold">{cartCount} поз. · {fmt(cartTotal)} сум</span>
            <span className="rounded-full bg-card/20 px-3 py-1 text-sm font-semibold">Оформить</span>
          </button>
        </div>
      )}

      {checkout && (
        <CheckoutModal
          items={cartItems}
          suppliers={suppliers}
          buyerName={(user?.user_metadata?.full_name as string) || ""}
          buyerPhone={(user?.user_metadata?.phone as string) || ""}
          onClose={() => setCheckout(false)}
          onPlaced={() => {
            setCart({});
            setCheckout(false);
          }}
        />
      )}
    </DoctorLayout>
  );
}

function CheckoutModal({
  items,
  suppliers,
  buyerName,
  buyerPhone,
  onClose,
  onPlaced,
}: {
  items: { product: Product; qty: number }[];
  suppliers: Record<string, Supplier>;
  buyerName: string;
  buyerPhone: string;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const [name, setName] = useState(buyerName);
  const [phone, setPhone] = useState(buyerPhone);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(0);

  // Orders are per-supplier — group the cart so each supplier gets one order.
  const groups = useMemo(() => {
    const m: Record<string, { product: Product; qty: number }[]> = {};
    items.forEach((it) => {
      (m[it.product.supplier_id] ||= []).push(it);
    });
    return Object.entries(m);
  }, [items]);

  const place = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Укажите контактное лицо и телефон");
      return;
    }
    setPlacing(true);
    let ok = 0;
    try {
      // One order per supplier. The server re-prices each line from the DB
      // (client prices are not trusted) and forces buyer = the caller.
      for (const [supplierId, groupItems] of groups) {
        await marketplace.placeOrder({
          supplier_id: supplierId,
          items: groupItems.map((x) => ({ product_id: x.product.id, quantity: x.qty })),
          contact_name: name.trim(),
          contact_phone: phone.trim(),
          delivery_address: address || undefined,
          note: note || undefined,
        });
        ok += 1;
        setDone(ok);
      }
      toast.success(groups.length > 1 ? `Оформлено заказов: ${ok}` : "Заказ оформлен");
      setTimeout(onPlaced, 1200);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось оформить заказ");
      setPlacing(false);
    }
  };

  const grandTotal = items.reduce((s, x) => s + x.qty * x.product.price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-[16px] bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="text-lg font-bold font-display">Оформление заказа</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {done > 0 && done === groups.length ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <div className="text-lg font-bold">Заказ отправлен поставщику</div>
            <div className="mt-1 text-sm text-muted-foreground">Поставщик свяжется с вами для подтверждения.</div>
          </div>
        ) : (
          <>
            <div className="space-y-3 px-5 py-4">
              {groups.map(([sid, gItems]) => (
                <div key={sid} className="rounded-prodent-btn border border-border p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Store className="h-3.5 w-3.5" /> {suppliers[sid]?.name || "Поставщик"}
                  </div>
                  {gItems.map((x) => (
                    <div key={x.product.id} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">{x.product.name} <span className="text-muted-foreground">× {x.qty}</span></span>
                      <span className="tabular-nums text-foreground">{fmt(x.qty * x.product.price)} сум</span>
                    </div>
                  ))}
                </div>
              ))}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Контактное лицо *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-prodent-input border border-border px-3 text-sm outline-none focus:border-[hsl(var(--brand))] focus:ring-2 focus:ring-[hsl(var(--brand-100))]" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Телефон *</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 …" className="h-10 w-full rounded-prodent-input border border-border px-3 text-sm outline-none focus:border-[hsl(var(--brand))] focus:ring-2 focus:ring-[hsl(var(--brand-100))]" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Адрес доставки</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="h-10 w-full rounded-prodent-input border border-border px-3 text-sm outline-none focus:border-[hsl(var(--brand))] focus:ring-2 focus:ring-[hsl(var(--brand-100))]" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Комментарий</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-prodent-input border border-border px-3 py-2 text-sm outline-none focus:border-[hsl(var(--brand))] focus:ring-2 focus:ring-[hsl(var(--brand-100))]" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Итого{groups.length > 1 ? ` · ${groups.length} заказа` : ""}</div>
                <div className="text-lg font-bold tabular-nums">{fmt(grandTotal)} сум</div>
              </div>
              <button
                onClick={place}
                disabled={placing}
                className="inline-flex h-11 items-center gap-2 rounded-prodent-input bg-primary px-5 text-base font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                Отправить заказ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
