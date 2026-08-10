import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Package, Plus, Store } from "lucide-react";
import { MARKET_ROUTES } from "@/lib/market-routes";
import { useMarketCart, type MarketProduct } from "@/contexts/MarketCartContext";
import { cn } from "@/lib/utils";

const fmt = (n: number) => Number(n).toLocaleString("ru-RU");

interface RibbonProduct extends MarketProduct {
  supplier_name?: string | null;
}

// Horizontal "ribbon" of product cards (other-from-supplier / similar) shown at
// the bottom of the product page. Scrolls horizontally; arrows on ≥sm screens.
export function ProductRibbon({ title, products }: { title: string; products: RibbonProduct[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const { qtyOf, setQty } = useMarketCart();

  if (!products.length) return null;

  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * 340, behavior: "smooth" });

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-bold font-display text-foreground">{title}</h2>
        <div className="hidden gap-1.5 sm:flex">
          <button type="button" onClick={() => scroll(-1)} aria-label="Прокрутить товары назад" className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Прокрутить товары вперёд" className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={scroller} className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {products.map((p) => {
          const inCart = qtyOf(p.id);
          const outOfStock = p.type === "product" && p.stock_quantity != null && p.stock_quantity <= 0;
          return (
            <article key={p.id} className="flex w-[172px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card">
              <Link to={MARKET_ROUTES.product(p.id)} aria-label={p.name} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                <div className="grid aspect-square place-items-center overflow-hidden bg-muted text-muted-foreground">
                  {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-9 w-9" />}
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-3">
                {p.supplier_name && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Store className="h-3 w-3" aria-hidden="true" /> <span className="truncate">{p.supplier_name}</span>
                  </div>
                )}
                <Link to={MARKET_ROUTES.product(p.id)} className="mt-0.5 inline-flex min-h-11 items-center line-clamp-2 text-meta font-medium leading-snug text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {p.name}
                </Link>
                <div className="mt-auto pt-2">
                  <div className="text-cell font-bold tabular-nums text-foreground">
                    {fmt(p.price)} <span className="text-xs font-normal text-muted-foreground">{p.currency === "UZS" ? "сум" : p.currency}</span>
                  </div>
                  {outOfStock ? (
                    <div className="mt-1.5 text-xs font-medium text-destructive">Нет в наличии</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setQty(p, inCart + 1)}
                      aria-label={`${inCart > 0 ? "Добавить ещё" : "Добавить в корзину"}: ${p.name}`}
                      className={cn(
                        "mt-1.5 inline-flex h-11 w-full items-center justify-center gap-1 rounded-[8px] text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        inCart > 0
                          ? "bg-primary/10 text-primary"
                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> <span aria-live="polite">{inCart > 0 ? `В корзине · ${inCart}` : "В корзину"}</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
