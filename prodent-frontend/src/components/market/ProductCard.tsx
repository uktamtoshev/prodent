import { Link } from "react-router-dom";
import { Minus, Package, Plus, ShieldCheck, Store } from "lucide-react";
import { MARKET_ROUTES } from "@/lib/market-routes";
import { useMarketCart, type MarketProduct } from "@/contexts/MarketCartContext";
import { isOutOfStock } from "@/lib/market-sort";
import { useLanguage, type Language } from "@/contexts/LanguageContext";

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

// Full catalog product card with add-to-cart — shared by the catalog and the
// supplier page. Pass supplierName to show the supplier row (catalog mixes
// suppliers); omit it on a single-supplier page.
export function ProductCard({
  product: p,
  supplierName,
  verified,
}: {
  product: MarketProduct;
  supplierName?: string | null;
  verified?: boolean;
}) {
  const { language, t } = useLanguage();
  const { qtyOf, setQty } = useMarketCart();
  const inCart = qtyOf(p.id);
  const outOfStock = isOutOfStock(p);

  return (
    <article className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-6px_rgba(15,23,42,0.06)]">
      <Link
        to={MARKET_ROUTES.product(p.id)}
        aria-label={p.name}
        className="grid aspect-[4/3] place-items-center overflow-hidden bg-muted text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-10 w-10" />}
      </Link>
      <div className="flex flex-1 flex-col p-3.5">
        {supplierName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Store className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">{supplierName}</span>
            {verified && <ShieldCheck className="h-3 w-3 text-success-green" aria-hidden="true" />}
          </div>
        )}
        <Link to={MARKET_ROUTES.product(p.id)} className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {p.name}
        </Link>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {p.type === "service"
            ? t("market.service")
            : p.category || t("market.product")}
        </div>
        <div className="mt-auto pt-3">
          <div className="text-[16px] font-bold tabular-nums text-foreground">
            {fmt(p.price, language)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {p.currency === "UZS" ? t("market.currencyUzs") : p.currency}/
              {p.unit || t("market.unitPiece")}
            </span>
          </div>
          {outOfStock ? (
            <div className="mt-2 text-xs font-medium text-destructive">
              {t("market.outOfStock")}
            </div>
          ) : inCart > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty(p, inCart - 1)}
                aria-label={`${t("market.decreaseQuantity")}: ${p.name}`}
                className="grid h-11 w-11 place-items-center rounded-[8px] border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[28px] text-center text-base font-semibold tabular-nums">{inCart}</span>
              <button
                type="button"
                onClick={() => setQty(p, inCart + 1)}
                aria-label={`${t("market.increaseQuantity")}: ${p.name}`}
                className="grid h-11 w-11 place-items-center rounded-[8px] border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setQty(p, 1)}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("market.addToCart")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
