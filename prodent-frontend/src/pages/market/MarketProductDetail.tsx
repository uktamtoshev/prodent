import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Boxes, ChevronLeft, ChevronRight, CreditCard, Flame, Loader2, MapPin,
  Minus, Package, Plus, ShieldCheck, ShoppingCart, Store, Truck,
} from "lucide-react";
import { marketplace } from "@/lib/marketplace";
import { supabase } from "@/integrations/supabase/client";
import { MARKET_ROUTES } from "@/lib/market-routes";
import { useMarketCart, type MarketProduct } from "@/contexts/MarketCartContext";
import { ProductRibbon } from "@/components/market/ProductRibbon";
import { cn } from "@/lib/utils";

interface ProductDetail extends MarketProduct {
  images?: string[] | null;
  sku?: string | null;
  min_quantity?: number | null;
  supplier_name?: string | null;
  supplier_verified?: boolean | null;
  supplier_city?: string | null;
  supplier_delivery_terms?: string | null;
  supplier_payment_terms?: string | null;
  supplier_warehouse_address?: string | null;
  ordered_this_month?: number;
  sold_total?: number;
}

const fmt = (n: number) => Number(n).toLocaleString("ru-RU");

export default function MarketProductDetail() {
  const { id = "" } = useParams();
  const { qtyOf, setQty } = useMarketCart();
  const [active, setActive] = useState(0);

  const { data: product, isLoading, error, refetch } = useQuery<ProductDetail>({
    queryKey: ["market-product", id],
    queryFn: () => marketplace.getProduct(id) as Promise<ProductDetail>,
    enabled: !!id,
  });

  const gallery = useMemo(() => {
    if (!product) return [];
    const imgs = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    const all = imgs.length ? imgs : product.image_url ? [product.image_url] : [];
    return all.slice(0, 5); // up to 5 photos
  }, [product]);

  // Ribbon 1 — other products from the same supplier (read via the public proxy).
  const { data: supplierProducts = [] } = useQuery<MarketProduct[]>({
    queryKey: ["mkt-supplier-products", product?.supplier_id, product?.id],
    enabled: !!product?.supplier_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_products").select("*")
        .eq("supplier_id", product!.supplier_id).eq("is_active", true).neq("id", product!.id).limit(24);
      return (data || []) as MarketProduct[];
    },
  });
  // Ribbon 2 — similar products (same category, any supplier).
  const { data: categoryProducts = [] } = useQuery<MarketProduct[]>({
    queryKey: ["mkt-category-products", product?.category, product?.id],
    enabled: !!product?.category,
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_products").select("*")
        .eq("category", product!.category).eq("is_active", true).neq("id", product!.id).limit(24);
      return (data || []) as MarketProduct[];
    },
  });
  // Keep the ribbons disjoint: "other from supplier" drops the current category
  // (those appear under "similar" below).
  const supplierMore = useMemo(
    () => supplierProducts.filter((p) => !product?.category || p.category !== product.category),
    [supplierProducts, product?.category],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span>Загружаем товар…</span>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[16px] border border-dashed border-border bg-card px-6 py-16 text-center" role={error ? "alert" : undefined}>
        <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <div className="text-[15px] font-semibold text-foreground">{error ? "Не удалось загрузить товар" : "Товар не найден"}</div>
        {error && <button type="button" onClick={() => void refetch()} className="mt-5 mr-2 inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-cell font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Повторить</button>}
        <Link to={MARKET_ROUTES.catalog()} className="mt-5 inline-flex h-11 items-center rounded-[10px] bg-primary px-4 text-cell font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          В каталог
        </Link>
      </div>
    );
  }

  const inCart = qtyOf(product.id);
  const isService = product.type === "service";
  const stock = product.stock_quantity;
  const outOfStock = !isService && stock != null && stock <= 0;
  const orderedMonth = product.ordered_this_month ?? 0;
  const activeImg = gallery[active] ?? gallery[0];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-meta text-muted-foreground">
        <Link to={MARKET_ROUTES.catalog()} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-3.5 w-3.5" /> Каталог
        </Link>
        {product.category && <><span>·</span><span className="text-muted-foreground">{product.category}</span></>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* Gallery + info */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Gallery */}
          <div className="flex gap-3 lg:w-[420px] lg:shrink-0">
            {gallery.length > 1 && (
              <div className="flex w-16 shrink-0 flex-col gap-2">
                {gallery.slice(0, 6).map((src, i) => (
                  <button
                    type="button"
                    key={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setActive(i)}
                    aria-label={`Показать фото ${i + 1}`}
                    aria-pressed={i === active}
                    className={cn(
                      "aspect-square overflow-hidden rounded-[9px] border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === active ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-foreground/40",
                    )}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex-1">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-[16px] border border-border bg-muted text-muted-foreground">
                {activeImg ? <img src={activeImg} alt={product.name} className="h-full w-full object-cover" /> : <Package className="h-16 w-16" />}
              </div>
              {gallery.length > 1 && (
                <>
                  <button type="button" aria-label="Предыдущее фото" onClick={() => setActive((a) => (a - 1 + gallery.length) % gallery.length)} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-foreground shadow hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Следующее фото" onClick={() => setActive((a) => (a + 1) % gallery.length)} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-foreground shadow hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <h1 className="leading-snug font-heading text-xl font-bold tracking-tight text-foreground">{product.name}</h1>

            {/* Supplier */}
            <Link to={MARKET_ROUTES.supplier(product.supplier_id)} className="mt-2 inline-flex min-h-11 flex-wrap items-center gap-1.5 text-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Store className="h-3.5 w-3.5" />
              <span className="font-medium">{product.supplier_name || "Поставщик"}</span>
              {product.supplier_verified && <ShieldCheck className="h-3.5 w-3.5 text-success-green" aria-hidden="true" />}
              {product.supplier_city && <span className="text-muted-foreground">· {product.supplier_city}</span>}
            </Link>

            {/* Demand / stock chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {orderedMonth > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-warning-amber/10 px-2.5 py-1.5 text-meta font-medium text-warning-amber">
                  <Flame className="h-3.5 w-3.5" /> В этом месяце заказали {fmt(orderedMonth)} шт
                </span>
              )}
              {!isService && stock != null && (
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-meta font-medium",
                  outOfStock ? "bg-destructive/10 text-destructive" : "bg-success-green/10 text-success-green",
                )}>
                  <Boxes className="h-3.5 w-3.5" /> {outOfStock ? "Нет в наличии" : `Остаток у поставщика: ${fmt(stock)} ${product.unit || "шт"}`}
                </span>
              )}
            </div>

            {product.description && (
              <p className="mt-4 whitespace-pre-line text-cell leading-relaxed text-muted-foreground">{product.description}</p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:max-w-[420px]">
              {product.brand && (<><dt className="text-muted-foreground">Бренд</dt><dd className="text-right font-medium text-foreground">{product.brand}</dd></>)}
              {product.sku && (<><dt className="text-muted-foreground">Артикул</dt><dd className="text-right font-medium text-foreground">{product.sku}</dd></>)}
              {product.category && (<><dt className="text-muted-foreground">Категория</dt><dd className="text-right font-medium text-foreground">{product.category}</dd></>)}
              {(product.sold_total ?? 0) > 0 && (<><dt className="text-muted-foreground">Всего заказано</dt><dd className="text-right font-medium text-foreground">{fmt(product.sold_total!)} шт</dd></>)}
            </dl>

            {/* Supplier delivery / payment terms + warehouse */}
            {(product.supplier_delivery_terms || product.supplier_payment_terms || product.supplier_warehouse_address) && (
              <div className="mt-5 space-y-3 rounded-[12px] border border-border bg-muted/40 p-4 sm:max-w-[480px]">
                <div className="text-sm font-semibold text-foreground">Доставка и оплата</div>
                {product.supplier_delivery_terms && (
                  <div className="flex gap-2.5">
                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand))]" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Условия доставки</div>
                      <div className="whitespace-pre-line text-sm text-foreground">{product.supplier_delivery_terms}</div>
                    </div>
                  </div>
                )}
                {product.supplier_payment_terms && (
                  <div className="flex gap-2.5">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand))]" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Условия оплаты</div>
                      <div className="whitespace-pre-line text-sm text-foreground">{product.supplier_payment_terms}</div>
                    </div>
                  </div>
                )}
                {product.supplier_warehouse_address && (
                  <div className="flex gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand))]" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Адрес склада</div>
                      <div className="text-sm text-foreground">{product.supplier_warehouse_address}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Price panel */}
        <div className="h-fit rounded-[16px] border border-border bg-card p-5 lg:sticky lg:top-[72px]">
          <div className="text-[26px] font-bold tabular-nums leading-none text-foreground">
            {fmt(product.price)} <span className="text-base font-normal text-muted-foreground">{product.currency === "UZS" ? "сум" : product.currency}/{product.unit || "шт"}</span>
          </div>

          {orderedMonth > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-meta text-warning-amber">
              <Flame className="h-3.5 w-3.5" /> В этом месяце заказали {fmt(orderedMonth)} шт
            </div>
          )}

          <div className="mt-4">
            {outOfStock ? (
              <div className="rounded-[10px] bg-destructive/10 px-3 py-2.5 text-center text-sm font-medium text-destructive">Нет в наличии</div>
            ) : inCart > 0 ? (
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`Уменьшить количество: ${product.name}`} onClick={() => setQty(product, inCart - 1)} className="grid h-11 w-11 place-items-center rounded-[10px] border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-primary/10 text-[15px] font-bold tabular-nums text-primary" aria-live="polite">{inCart}</div>
                <button type="button" aria-label={`Увеличить количество: ${product.name}`} onClick={() => setQty(product, inCart + 1)} className="grid h-11 w-11 place-items-center rounded-[10px] border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setQty(product, 1)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ShoppingCart className="h-5 w-5" /> В корзину
              </button>
            )}
            {inCart > 0 && (
              <Link to={MARKET_ROUTES.cart()} className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-border text-cell font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Перейти в корзину
              </Link>
            )}
          </div>

          {!isService && stock != null && !outOfStock && (
            <div className="mt-3 flex items-center gap-1.5 text-meta text-muted-foreground">
              <Boxes className="h-3.5 w-3.5 text-success-green" /> Остаток у поставщика: <span className="font-semibold text-foreground">{fmt(stock)} {product.unit || "шт"}</span>
            </div>
          )}

          <Link to={MARKET_ROUTES.supplier(product.supplier_id)} className="mt-3 flex min-h-11 items-center gap-1.5 border-t border-border pt-3 text-meta text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Store className="h-3.5 w-3.5" /> Все товары: <span className="font-medium text-foreground">{product.supplier_name || "поставщика"}</span>
          </Link>
        </div>
      </div>

      <ProductRibbon title="Другие товары поставщика" products={supplierMore} />
      <ProductRibbon title="Похожие товары" products={categoryProducts} />
    </div>
  );
}
