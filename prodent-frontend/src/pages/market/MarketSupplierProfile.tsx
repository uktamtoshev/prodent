import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Loader2, MapPin, Package, ShieldCheck, ShoppingCart, Star, Store, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMarketCart, type MarketProduct } from "@/contexts/MarketCartContext";
import { MARKET_ROUTES } from "@/lib/market-routes";
import { isOutOfStock, sortProducts, type SortKey } from "@/lib/market-sort";
import { ProductCard } from "@/components/market/ProductCard";
import { MarketToolbar } from "@/components/market/MarketToolbar";
import { SupplierReviews } from "@/components/market/SupplierReviews";

interface Supplier {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  phone: string | null;
  rating: number;
  reviews_count: number;
  is_verified: boolean;
  delivery_terms: string | null;
  payment_terms: string | null;
  warehouse_address: string | null;
}

const fmt = (n: number) => Number(n).toLocaleString("ru-RU");

// Supplier storefront: header + all of the supplier's products with sort/search.
// Ordering everything here builds a single-supplier cart → one delivery.
export default function MarketSupplierProfile() {
  const { id = "" } = useParams();
  const { count, total } = useMarketCart();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(false);
      setNotFound(false);
      const [sRes, pRes] = await Promise.all([
        supabase.from("marketplace_suppliers").select("*").eq("id", id).eq("is_active", true).maybeSingle(),
        supabase.from("marketplace_products").select("*").eq("supplier_id", id).eq("is_active", true).order("created_at", { ascending: false }),
      ]);
      if (sRes.error || pRes.error) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      if (!sRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSupplier(sRes.data as Supplier);
      setProducts((pRes.data as MarketProduct[]) || []);
      setLoading(false);
    })();
  }, [id, loadAttempt]);

  // Refresh just the supplier row (header rating) after a new review.
  const reloadSupplier = async () => {
    const { data } = await supabase.from("marketplace_suppliers").select("*").eq("id", id).maybeSingle();
    if (data) setSupplier(data as Supplier);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const base = products.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false) ||
        (p.category?.toLowerCase().includes(q) ?? false);
      const matchStock = !inStockOnly || !isOutOfStock(p);
      return matchQ && matchStock;
    });
    return sortProducts(base, sort);
  }, [products, query, inStockOnly, sort]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span>Загружаем поставщика…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[16px] border border-destructive/30 bg-destructive/10 px-6 py-12 text-center" role="alert">
        <p className="text-sm font-medium text-destructive">Не удалось загрузить поставщика.</p>
        <button type="button" onClick={() => setLoadAttempt((value) => value + 1)} className="mt-4 h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Повторить</button>
      </div>
    );
  }

  if (notFound || !supplier) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[16px] border border-dashed border-border bg-card px-6 py-16 text-center">
        <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <div className="text-[15px] font-semibold text-foreground">Поставщик не найден</div>
        <Link to={MARKET_ROUTES.catalog()} className="mt-5 inline-flex h-11 items-center rounded-[10px] bg-primary px-4 text-cell font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link to={MARKET_ROUTES.catalog()} className="inline-flex min-h-11 items-center gap-1 text-meta text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Каталог
        </Link>
      </div>

      {/* Supplier header */}
      <div className="mb-5 rounded-[16px] border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-primary/10 text-primary">
            {supplier.logo_url ? <img src={supplier.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="h-7 w-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="leading-tight font-heading text-xl font-bold tracking-tight text-foreground">{supplier.name}</h1>
              {supplier.is_verified && (
                <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-success-green/10 px-2 text-xs font-medium text-success-green">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Проверенный
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-foreground">
              {supplier.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {supplier.city}</span>}
              {supplier.rating > 0 && (
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning-amber text-warning-amber" aria-hidden="true" /> {supplier.rating.toFixed(1)} ({supplier.reviews_count})</span>
              )}
              <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {products.length} товаров</span>
            </div>
            {supplier.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{supplier.description}</p>}
          </div>
        </div>
        {(supplier.delivery_terms || supplier.payment_terms || supplier.warehouse_address) && (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
            {supplier.delivery_terms && (
              <div className="flex gap-2">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand))]" />
                <div className="min-w-0"><div className="text-xs text-muted-foreground">Условия доставки</div><div className="whitespace-pre-line text-meta text-foreground">{supplier.delivery_terms}</div></div>
              </div>
            )}
            {supplier.payment_terms && (
              <div className="flex gap-2">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand))]" />
                <div className="min-w-0"><div className="text-xs text-muted-foreground">Условия оплаты</div><div className="whitespace-pre-line text-meta text-foreground">{supplier.payment_terms}</div></div>
              </div>
            )}
            {supplier.warehouse_address && (
              <div className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand))]" />
                <div className="min-w-0"><div className="text-xs text-muted-foreground">Адрес склада</div><div className="text-meta text-foreground">{supplier.warehouse_address}</div></div>
              </div>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <Truck className="h-3.5 w-3.5 text-[hsl(var(--brand))]" /> Соберите заказ у одного поставщика — это одна доставка.
        </div>
      </div>

      <MarketToolbar
        query={query}
        onQuery={setQuery}
        sort={sort}
        onSort={setSort}
        inStockOnly={inStockOnly}
        onToggleStock={() => setInStockOnly((v) => !v)}
        resultCount={filtered.length}
        placeholder="Поиск по товарам поставщика…"
      />

      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-card px-6 py-16 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
          <div className="text-[15px] font-semibold text-foreground">
            {products.length === 0 ? "У поставщика пока нет товаров" : "Ничего не найдено"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* Reviews */}
      <SupplierReviews supplierId={id} onReviewed={reloadSupplier} />

      {/* Floating "go to cart" bar */}
      {count > 0 && (
        <div className="fixed inset-x-4 bottom-5 z-40 flex justify-center">
          <Link
            to={MARKET_ROUTES.cart()}
            aria-label={`Перейти в корзину: ${count} позиций`}
            className="inline-flex min-h-12 w-full max-w-md items-center justify-between gap-2 rounded-full bg-primary py-2 pl-4 pr-2 text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-cell font-semibold">{count} поз. · {fmt(total)} сум</span>
            <span className="hidden rounded-full bg-primary-foreground/20 px-3 py-1 text-sm font-semibold sm:inline">Перейти в корзину</span>
          </Link>
        </div>
      )}
    </div>
  );
}
