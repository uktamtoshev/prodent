import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Package, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMarketCart, type MarketProduct } from "@/contexts/MarketCartContext";
import { MARKET_ROUTES } from "@/lib/market-routes";
import { type SortKey } from "@/lib/market-sort";
import { ProductCard } from "@/components/market/ProductCard";
import { MarketToolbar } from "@/components/market/MarketToolbar";
import { marketplace } from "@/lib/marketplace";
import { useLanguage, type Language } from "@/contexts/LanguageContext";

interface Supplier {
  id: string;
  name: string;
  city: string | null;
  is_verified: boolean;
}

const numberLocales: Record<Language, string> = {
  ru: "ru-RU",
  uz: "uz-Latn-UZ",
  uz_cyrl: "uz-Cyrl-UZ",
  kz: "kk-KZ",
  kg: "ky-KG",
  tj: "tg-TJ",
};
const fmt = (n: number, language: Language) =>
  Number(n).toLocaleString(numberLocales[language]);

// Marketplace catalog. Filtering and ordering here must stay server-side so
// pagination never turns page-local data into a fake global result.
export default function MarketCatalog() {
  const { language, t } = useLanguage();
  const { count, total } = useMarketCart();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setDebouncedQuery(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setPage(0), [minPrice, maxPrice, sort]);

  const catalog = useQuery({
    queryKey: ["marketplace", "catalog", page, debouncedQuery, minPrice, maxPrice, sort],
    queryFn: () => marketplace.listCatalog({
      page,
      size: 24,
      search: debouncedQuery || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort: sort === "cheap" ? "price_asc" : sort === "expensive" ? "price_desc" : "newest",
    }),
    placeholderData: (previous) => previous,
  });
  const products = useMemo(
    () => (catalog.data?.items || []) as MarketProduct[],
    [catalog.data?.items],
  );
  const suppliers = useMemo(() => {
    const map: Record<string, Supplier> = {};
    for (const product of catalog.data?.items || []) {
      map[product.supplier_id] = {
        id: product.supplier_id,
        name: product.supplier_name || "",
        city: product.supplier_city || null,
        is_verified: product.supplier_verified === true,
      };
    }
    return map;
  }, [catalog.data?.items]);
  const loading = catalog.isLoading || catalog.isFetching;

  return (
    <div>
      <div className="mb-4">
        <h1 className="leading-tight font-heading text-xl font-bold tracking-tight text-foreground">
          {t("market.catalogTitle")}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("market.catalogSubtitle")}
        </p>
      </div>

      {/* Разделы маркета вкладками, как в макете. Это не переключатели
          содержимого одной страницы: корзина и заказы — отдельные экраны,
          поэтому вкладка ведёт на свой маршрут. «Избранное» из эталона нет —
          такого раздела в маркете не существует. */}
      <div className="mb-section flex flex-wrap items-center gap-0.5">
        <span className="cabinet-control inline-flex items-center rounded-t-field border border-b-0 border-border bg-card px-3 py-2 text-cell font-semibold text-primary shadow-soft">
          {t("market.catalogTitle")}
        </span>
        <Link
          to={MARKET_ROUTES.cart()}
          className="cabinet-control inline-flex items-center rounded-t-field px-3 py-2 text-cell font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("market.cartTitle")}
        </Link>
        <Link
          to={MARKET_ROUTES.orders()}
          className="cabinet-control inline-flex items-center rounded-t-field px-3 py-2 text-cell font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("market.myOrdersTitle")}
        </Link>
      </div>

      <div className="min-w-0">
          <MarketToolbar
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={setSort}
            sortKeys={["new", "cheap", "expensive"]}
            showInStock={false}
            inStockOnly={false}
            onToggleStock={() => undefined}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onMinPrice={setMinPrice}
            onMaxPrice={setMaxPrice}
            resultCount={null}
            placeholder={t("market.searchPlaceholder")}
          />

          {catalog.isError ? (
            <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 px-6 py-12 text-center" role="alert">
              <div className="font-semibold text-destructive">
                {t("market.loadError")}
              </div>
              <button type="button" className="mt-3 min-h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => void catalog.refetch()}>
                {t("market.retry")}
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              <span>Загружаем каталог…</span>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border bg-card px-6 py-20 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
              <div className="text-[15px] font-semibold text-foreground">
                {debouncedQuery || minPrice || maxPrice
                  ? t("market.nothingFound")
                  : t("market.emptyCatalog")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {debouncedQuery || minPrice || maxPrice
                  ? t("market.changeSearchOrCategory")
                  : t("market.emptyCatalogDescription")}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    supplierName={
                      suppliers[p.supplier_id]?.name ||
                      t("market.supplierFallback")
                    }
                    verified={suppliers[p.supplier_id]?.is_verified}
                  />
                ))}
            </div>
          )}

          {!catalog.isError && !loading && (page > 0 || catalog.data?.has_more) && (
              <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Страницы каталога">
                <button
                  type="button"
                  className="h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  disabled={page === 0 || catalog.isFetching}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  {t("market.previous")}
                </button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {t("market.page")} {page + 1}
                </span>
                <button
                  type="button"
                  className="h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  disabled={!catalog.data?.has_more || catalog.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {t("market.next")}
                </button>
              </nav>
          )}
      </div>

      {/* Floating "go to cart" bar */}
      {count > 0 && (
        <div className="fixed inset-x-4 bottom-5 z-40 flex justify-center">
          <Link
            to={MARKET_ROUTES.cart()}
            aria-label={`${t("market.goToCart")}: ${count} ${t("market.itemsShort")}`}
            className="inline-flex min-h-12 w-full max-w-md items-center justify-between gap-2 rounded-full bg-primary py-2 pl-4 pr-2 text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-cell font-semibold">
              {count} {t("market.itemsShort")} · {fmt(total, language)}{" "}
              {t("market.currencyUzs")}
            </span>
            <span className="hidden rounded-full bg-primary-foreground/20 px-3 py-1 text-sm font-semibold sm:inline">
              {t("market.goToCart")}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
