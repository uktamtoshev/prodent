import { ArrowUpDown, ChevronDown, PackageCheck, Search } from "lucide-react";
import { SORTS, type SortKey } from "@/lib/market-sort";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

// Controlled search + sort + in-stock toolbar (with an optional result counter),
// shared by the catalog and the supplier page.
export function MarketToolbar({
  query,
  onQuery,
  sort,
  onSort,
  inStockOnly,
  onToggleStock,
  resultCount,
  placeholder,
  minPrice = "",
  maxPrice = "",
  onMinPrice,
  onMaxPrice,
  sortKeys = SORTS.map((item) => item.key),
  showInStock = true,
}: {
  query: string;
  onQuery: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  inStockOnly: boolean;
  onToggleStock: () => void;
  resultCount?: number | null;
  placeholder?: string;
  // Optional price-range filter (catalog only; the supplier page omits it).
  minPrice?: string;
  maxPrice?: string;
  onMinPrice?: (v: string) => void;
  onMaxPrice?: (v: string) => void;
  sortKeys?: readonly SortKey[];
  showInStock?: boolean;
}) {
  const { t } = useLanguage();
  const sortLabels: Record<SortKey, string> = {
    new: t("market.sortNew"),
    cheap: t("market.sortCheap"),
    expensive: t("market.sortExpensive"),
    name: t("market.sortName"),
  };
  const priceCls =
    "h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-background px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-24 sm:flex-none";
  return (
    <>
      <div className="mb-3 flex flex-wrap items-stretch gap-2 sm:items-center">
        <div className="relative w-full min-w-0 sm:min-w-[220px] sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder || t("market.searchPlaceholder")}
            aria-label={placeholder || t("market.searchPlaceholder")}
            className="h-11 w-full rounded-[10px] border border-border bg-background pl-9 pr-3 text-cell text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="relative w-full sm:w-auto">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="h-11 w-full appearance-none rounded-[10px] border border-border bg-background pl-9 pr-9 text-cell font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            aria-label={t("market.sortLabel")}
          >
            {SORTS.filter((item) => sortKeys.includes(item.key)).map((s) => (
              <option key={s.key} value={s.key}>{sortLabels[s.key]}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>

        {onMinPrice && onMaxPrice && (
          <div className="flex w-full min-w-0 items-center gap-1 sm:w-auto">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minPrice}
              onChange={(e) => onMinPrice(e.target.value)}
              placeholder={t("market.priceFrom")}
              aria-label={t("market.priceFrom")}
              className={priceCls}
            />
            <span className="text-muted-foreground" aria-hidden="true">—</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxPrice}
              onChange={(e) => onMaxPrice(e.target.value)}
              placeholder={t("market.priceTo")}
              aria-label={t("market.priceTo")}
              className={priceCls}
            />
          </div>
        )}

        {showInStock && (
          <button
            type="button"
            onClick={onToggleStock}
            aria-pressed={inStockOnly}
            className={cn(
              "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto",
              inStockOnly
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <PackageCheck className="h-4 w-4" aria-hidden="true" /> {t("market.inStock")}
          </button>
        )}
      </div>

      {resultCount != null && (
        <div className="mb-3 text-meta text-muted-foreground" role="status" aria-live="polite">
          {t("market.found")}:{" "}
          <span className="font-semibold text-foreground">{resultCount}</span>
        </div>
      )}
    </>
  );
}
