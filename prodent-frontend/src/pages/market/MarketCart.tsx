import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Minus, Package, Plus, ShoppingCart, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMarketCart, type CartLine } from "@/contexts/MarketCartContext";
import { marketplace } from "@/lib/marketplace";
import { MARKET_ROUTES } from "@/lib/market-routes";

const fmt = (n: number) => Number(n).toLocaleString("ru-RU");

// Cart + checkout for the standalone market. Orders are placed PER SUPPLIER
// (MarketplaceController re-prices each line from the DB and forces buyer = caller).
export default function MarketCart() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, setQty, remove, clear, count, total } = useMarketCart();

  const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});
  const [name, setName] = useState((user?.user_metadata?.full_name as string) || "");
  const [phone, setPhone] = useState((user?.user_metadata?.phone as string) || "");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const requestIds = useRef<Record<string, string>>({});

  // Resolve supplier display names for grouping headers.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("marketplace_suppliers").select("id,name");
      const map: Record<string, string> = {};
      ((data as { id: string; name: string }[]) || []).forEach((s) => (map[s.id] = s.name));
      setSupplierNames(map);
    })();
  }, []);

  // Group the cart by supplier — one order per supplier.
  const groups = useMemo(() => {
    const m: Record<string, CartLine[]> = {};
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
      for (const [supplierId, groupItems] of groups) {
        const clientRequestId =
          requestIds.current[supplierId] ||
          (requestIds.current[supplierId] = crypto.randomUUID());
        await marketplace.placeOrder({
          supplier_id: supplierId,
          client_request_id: clientRequestId,
          items: groupItems.map((x) => ({ product_id: x.product.id, quantity: x.qty })),
          contact_name: name.trim(),
          contact_phone: phone.trim(),
          delivery_address: address || undefined,
          note: note || undefined,
        });
        ok += 1;
      }
      toast.success(groups.length > 1 ? `Оформлено заказов: ${ok}` : "Заказ оформлен");
      clear();
      requestIds.current = {};
      setPlaced(true);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Не удалось оформить заказ");
      setPlacing(false);
    }
  };

  // Success screen (cart cleared).
  if (placed) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[16px] border border-border bg-card px-6 py-14 text-center" role="status" aria-live="polite">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-success-green" aria-hidden="true" />
        <div className="text-[18px] font-bold font-display text-foreground">Заказ отправлен поставщику</div>
        <div className="mt-1.5 text-cell text-muted-foreground">Поставщик свяжется с вами для подтверждения.</div>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <Link to={MARKET_ROUTES.orders()} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-primary px-4 text-cell font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Мои заказы
          </Link>
          <Link to={MARKET_ROUTES.catalog()} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-border px-4 text-cell font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            В каталог
          </Link>
        </div>
      </div>
    );
  }

  // Empty cart.
  if (count === 0) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[16px] border border-dashed border-border bg-card px-6 py-16 text-center">
        <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <div className="text-[15px] font-semibold text-foreground">Корзина пуста</div>
        <div className="mt-1 text-sm text-muted-foreground">Добавьте товары из каталога.</div>
        <Link to={MARKET_ROUTES.catalog()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-4 text-cell font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> В каталог
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={() => navigate(MARKET_ROUTES.catalog())} className="inline-flex h-11 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Каталог
        </button>
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">{t("market.cartTitle")}</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Items grouped by supplier */}
        <div className="space-y-4">
          {groups.map(([sid, gItems]) => {
            const groupSum = gItems.reduce((s, x) => s + x.qty * x.product.price, 0);
            return (
              <section key={sid} className="overflow-hidden rounded-[14px] border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Store className="h-3.5 w-3.5" aria-hidden="true" /> {supplierNames[sid] || "Поставщик"}
                  </div>
                  <div className="text-xs text-muted-foreground">{gItems.length} поз.</div>
                </div>
                <div className="divide-y divide-border">
                  {gItems.map(({ product: p, qty }) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:px-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-muted text-muted-foreground">
                        {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-cell font-medium text-foreground">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmt(p.price)} {p.currency === "UZS" ? "сум" : p.currency}/{p.unit || "шт"}
                        </div>
                      </div>
                      <div className="order-4 ml-[60px] flex items-center gap-1.5 sm:order-none sm:ml-0">
                        <button type="button" aria-label={`Уменьшить количество: ${p.name}`} onClick={() => setQty(p, qty - 1)} className="grid h-11 w-11 place-items-center rounded-[8px] border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span className="min-w-[26px] text-center text-cell font-semibold tabular-nums">{qty}</span>
                        <button type="button" aria-label={`Увеличить количество: ${p.name}`} onClick={() => setQty(p, qty + 1)} className="grid h-11 w-11 place-items-center rounded-[8px] border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="order-5 ml-auto text-right text-cell font-semibold tabular-nums text-foreground sm:order-none sm:w-[92px]">{fmt(qty * p.price)}</div>
                      <button type="button" aria-label={`Удалить из корзины: ${p.name}`} onClick={() => remove(p.id)} className="grid h-11 w-11 place-items-center rounded-[8px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Подытог:</span>
                  <span className="font-semibold tabular-nums">{fmt(groupSum)} сум</span>
                </div>
              </section>
            );
          })}
        </div>

        {/* Checkout panel */}
        <div className="h-fit space-y-3 rounded-[14px] border border-border bg-card p-4 lg:sticky lg:top-[72px]">
          <div className="text-[15px] font-bold font-display">Оформление</div>

          <div>
            <label htmlFor="market-contact-name" className="mb-1 block text-meta font-medium text-muted-foreground">Контактное лицо *</label>
            <input id="market-contact-name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-[10px] border border-border bg-background px-3 text-cell text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label htmlFor="market-contact-phone" className="mb-1 block text-meta font-medium text-muted-foreground">Телефон *</label>
            <input id="market-contact-phone" required type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 …" className="h-11 w-full rounded-[10px] border border-border bg-background px-3 text-cell text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label htmlFor="market-delivery-address" className="mb-1 block text-meta font-medium text-muted-foreground">Адрес доставки</label>
            <input id="market-delivery-address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} className="h-11 w-full rounded-[10px] border border-border bg-background px-3 text-cell text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label htmlFor="market-order-note" className="mb-1 block text-meta font-medium text-muted-foreground">Комментарий</label>
            <textarea id="market-order-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="min-h-20 w-full rounded-[10px] border border-border bg-background px-3 py-2 text-cell text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">Итого{groups.length > 1 ? ` · ${groups.length} заказа` : ""}</div>
            <div className="text-[18px] font-bold tabular-nums">{fmt(total)} сум</div>
          </div>
          <button
            type="button"
            onClick={place}
            disabled={placing}
            aria-busy={placing}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
            Отправить заказ
          </button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {groups.length > 1 ? "Будет создан отдельный заказ для каждого поставщика." : "Поставщик свяжется с вами для подтверждения."}
          </p>
        </div>
      </div>
    </div>
  );
}
