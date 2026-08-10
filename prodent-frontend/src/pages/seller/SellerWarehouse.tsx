import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  Search,
  Settings2,
  Store,
  TrendingDown,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { marketplace } from "@/lib/marketplace";

interface Product {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  sku: string | null;
  unit: string | null;
  price: number;
  currency: string;
  stock_quantity: number | null;
  min_quantity: number | null;
  expiry_date: string | null;
  type: "product" | "service";
}

interface Tx {
  id: string;
  product_name: string;
  type: "income" | "writeoff" | "adjustment";
  quantity: number;
  reason: string | null;
  balance_after: number;
  created_at: string;
}

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString("ru-RU");

type Status = "out" | "low" | "expiring" | "ok";
const stockStatus = (p: Product): Status => {
  const stock = p.stock_quantity ?? 0;
  if (stock <= 0) return "out";
  if ((p.min_quantity ?? 0) > 0 && stock < (p.min_quantity ?? 0)) return "low";
  if (p.expiry_date) {
    const days = Math.round((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
    if (days < 30) return "expiring";
  }
  return "ok";
};
const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  ok: { label: "В норме", cls: "bg-[hsl(var(--success-green)/0.12)] text-[hsl(var(--success-green))] ring-[hsl(var(--success-green)/0.3)]", dot: "bg-[hsl(var(--success-green))]" },
  low: { label: "Заканчивается", cls: "bg-[hsl(var(--warning-amber)/0.12)] text-[hsl(var(--warning-amber))] ring-[hsl(var(--warning-amber)/0.3)]", dot: "bg-[hsl(var(--warning-amber))]" },
  out: { label: "Закончилось", cls: "bg-destructive/10 text-destructive ring-destructive/30", dot: "bg-destructive" },
  expiring: { label: "Скоро истекает", cls: "bg-[hsl(var(--warning-amber)/0.12)] text-[hsl(var(--warning-amber))] ring-[hsl(var(--warning-amber)/0.3)]", dot: "bg-[hsl(var(--warning-amber))]" },
};

const TX_META: Record<Tx["type"], { label: string; cls: string; sign: string }> = {
  income: { label: "Поступление", cls: "text-[hsl(var(--success-green))]", sign: "+" },
  writeoff: { label: "Списание", cls: "text-destructive", sign: "−" },
  adjustment: { label: "Корректировка", cls: "text-muted-foreground", sign: "=" },
};

function useDialogFocus(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const getFocusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    const focusFrame = requestAnimationFrame(() => {
      const first = getFocusable()[0];
      (first ?? dialog)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return dialogRef;
}

/* ── Stock operation dialog ────────────────────────────────────────────── */
function StockDialog({
  open,
  products,
  initial,
  onClose,
  onDone,
}: {
  open: boolean;
  products: Product[];
  initial: { type: Tx["type"]; productId?: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<Tx["type"]>("income");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [productTouched, setProductTouched] = useState(false);
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initial) {
      setType(initial.type);
      setProductId(initial.productId || "");
      setQuantity(1);
      setReason("");
      setProductTouched(false);
      setQuantityTouched(false);
    }
  }, [open, initial]);
  const dialogRef = useDialogFocus(open, onClose);

  if (!open) return null;
  const product = products.find((p) => p.id === productId);
  const current = product?.stock_quantity ?? 0;
  const preview =
    type === "income" ? current + quantity : type === "writeoff" ? Math.max(0, current - quantity) : quantity;

  const save = async () => {
    if (!productId) return toast.error("Выберите позицию");
    if (type !== "adjustment" && quantity <= 0) return toast.error("Количество должно быть больше 0");
    setSaving(true);
    try {
      await marketplace.adjustStock(productId, { type, quantity, reason: reason || undefined });
      toast.success(`${TX_META[type].label}: ${product?.name}`);
      onDone();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить операцию");
    } finally {
      setSaving(false);
    }
  };

  const TYPES: { id: Tx["type"]; label: string }[] = [
    { id: "income", label: "Поступление" },
    { id: "writeoff", label: "Списание" },
    { id: "adjustment", label: "Корректировка" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="stock-dialog-title" aria-describedby="stock-dialog-description" tabIndex={-1} className="max-h-[calc(100dvh-2rem)] w-full max-w-[460px] overflow-y-auto rounded-[16px] bg-card text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div id="stock-dialog-title" className="text-[16px] font-bold font-display">Движение по складу</div>
          <p id="stock-dialog-description" className="sr-only">Выберите товар, тип операции и количество.</p>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex gap-2">
            {TYPES.map((tp) => (
              <button
                type="button"
                key={tp.id}
                onClick={() => setType(tp.id)}
                className={cn(
                  "min-h-11 flex-1 rounded-[10px] px-2 text-[12.5px] font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  type === tp.id
                    ? "bg-[hsl(var(--brand-50))] text-[hsl(var(--brand-700))] ring-[hsl(var(--brand-100))]"
                    : "bg-card text-muted-foreground ring-border hover:bg-muted"
                )}
              >
                {tp.label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="stock-product" className="mb-1 block text-[12.5px] font-medium text-muted-foreground">Позиция</label>
            <select
              id="stock-product"
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              onBlur={() => setProductTouched(true)}
              aria-invalid={productTouched && !productId}
              aria-describedby={productTouched && !productId ? "stock-product-error" : undefined}
              className="h-11 w-full rounded-[10px] border border-border bg-background px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Выберите товар…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.stock_quantity ?? 0} {p.unit || "шт"})
                </option>
              ))}
            </select>
            {productTouched && !productId && (
              <p id="stock-product-error" className="mt-1 text-xs text-destructive" role="alert">
                Выберите позицию
              </p>
            )}
          </div>
          <div>
            <label htmlFor="stock-quantity" className="mb-1 block text-[12.5px] font-medium text-muted-foreground">
              {type === "adjustment" ? "Новый остаток" : "Количество"}
            </label>
            <input
              id="stock-quantity"
              type="number"
              min={type === "adjustment" ? 0 : 1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              onBlur={() => setQuantityTouched(true)}
              aria-invalid={quantityTouched && (quantity < 0 || (type !== "adjustment" && quantity <= 0))}
              aria-describedby={
                quantityTouched && (quantity < 0 || (type !== "adjustment" && quantity <= 0))
                  ? "stock-quantity-error"
                  : undefined
              }
              className="h-11 w-full rounded-[10px] border border-border bg-background px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {quantityTouched && (quantity < 0 || (type !== "adjustment" && quantity <= 0)) && (
              <p id="stock-quantity-error" className="mt-1 text-xs text-destructive" role="alert">
                Укажите допустимое количество
              </p>
            )}
            {product && (
              <div className="mt-1 text-[12px] text-muted-foreground" aria-live="polite">
                Текущий: <b className="tabular-nums">{current}</b> → станет{" "}
                <b className="tabular-nums text-foreground">{preview}</b> {product.unit || "шт"}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="stock-reason" className="mb-1 block text-[12.5px] font-medium text-muted-foreground">Причина / комментарий</label>
            <textarea
              id="stock-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={type === "income" ? "Например: поставка от производителя" : "Например: брак, продажа, инвентаризация"}
              className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-[10px] border border-border px-4 text-[13.5px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !productId || quantity < 0 || (type !== "adjustment" && quantity <= 0)}
            aria-busy={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Применить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Threshold (min stock + expiry) dialog ─────────────────────────────── */
function ThresholdDialog({ product, onClose, onDone }: { product: Product | null; onClose: () => void; onDone: () => void }) {
  const [min, setMin] = useState<string>(product?.min_quantity?.toString() ?? "");
  const [expiry, setExpiry] = useState<string>(product?.expiry_date?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setMin(product?.min_quantity?.toString() ?? "");
    setExpiry(product?.expiry_date?.slice(0, 10) ?? "");
  }, [product]);
  const dialogRef = useDialogFocus(!!product, onClose);
  if (!product) return null;

  const save = async () => {
    setSaving(true);
    try {
      await marketplace.updateProduct(product.id, {
        min_quantity: min === "" ? null : Number(min),
        expiry_date: expiry || null,
      });
      toast.success("Параметры сохранены");
      onDone();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="threshold-dialog-title" tabIndex={-1} className="max-h-[calc(100dvh-2rem)] w-full max-w-[420px] overflow-y-auto rounded-[16px] bg-card text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div id="threshold-dialog-title" className="text-[15px] font-bold font-display truncate pr-2">{product.name}</div>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="minimum-stock" className="mb-1 block text-[12.5px] font-medium text-muted-foreground">Минимальный остаток (порог)</label>
            <input id="minimum-stock" type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} placeholder="например 10" aria-describedby="minimum-stock-help"
              className="h-11 w-full rounded-[10px] border border-border bg-background px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <div id="minimum-stock-help" className="mt-1 text-[12px] text-muted-foreground">Ниже этого значения позиция помечается «Заканчивается».</div>
          </div>
          <div>
            <label htmlFor="stock-expiry" className="mb-1 block text-[12.5px] font-medium text-muted-foreground">Срок годности</label>
            <input id="stock-expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-border bg-background px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-[10px] border border-border px-4 text-[13.5px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Отмена</button>
          <button type="button" onClick={save} disabled={saving} aria-busy={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Movement log panel ────────────────────────────────────────────────── */
function MovementLog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    marketplace
      .listStockTransactions()
      .then((data) => setTxs(data))
      .catch(() => toast.error("Не удалось загрузить журнал"))
      .finally(() => setLoading(false));
  }, [open]);
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/40" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="movement-log-title" tabIndex={-1} className="h-full w-full max-w-[480px] overflow-y-auto bg-card text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div id="movement-log-title" className="text-[16px] font-bold font-display">Журнал движений</div>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-16" role="status" aria-live="polite"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" /><span className="sr-only">Загрузка журнала</span></div>
        ) : txs.length === 0 ? (
          <div className="px-5 py-16 text-center text-[13px] text-muted-foreground" role="status">Движений пока нет</div>
        ) : (
          <div className="divide-y divide-border">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-foreground">{t.product_name}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-[13px] font-semibold tabular-nums", TX_META[t.type].cls)}>
                    {TX_META[t.type].sign}{t.quantity}
                  </div>
                  <div className="text-[12px] text-muted-foreground tabular-nums">→ {t.balance_after}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export const SellerWarehouse = () => {
  const { user } = useAuth();
  const [hasSupplier, setHasSupplier] = useState<boolean | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [stockOp, setStockOp] = useState<{ type: Tx["type"]; productId?: string } | null>(null);
  const [thresholdItem, setThresholdItem] = useState<Product | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const refresh = async () => {
    if (!user?.id) {
      setItems([]);
      setHasSupplier(null);
      setLoadError("Не удалось определить пользователя.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const sup = (await marketplace.getMySupplier()) as { id: string } | null;
      setHasSupplier(!!sup);
      if (!sup) {
        setItems([]);
        return;
      }
      const products = (await marketplace.listMyProducts()) as unknown as Array<Product & { type?: string }>;
      setItems(products.filter((product) => product.type !== "service").sort((a, b) => a.name.localeCompare(b.name, "ru")));
    } catch {
      setItems([]);
      setLoadError("Не удалось загрузить склад. Проверьте соединение и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.category && set.add(it.category));
    return ["Все", ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((s) => {
      const matchQ =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.brand?.toLowerCase().includes(q) ?? false) ||
        (s.sku?.toLowerCase().includes(q) ?? false);
      const matchCat = activeCategory === "Все" || s.category === activeCategory;
      return matchQ && matchCat;
    });
  }, [items, query, activeCategory]);

  const lowCount = items.filter((s) => ["low", "out"].includes(stockStatus(s))).length;
  const expiringCount = items.filter((s) => stockStatus(s) === "expiring").length;
  const totalValue = items.reduce((sum, s) => sum + (s.stock_quantity || 0) * (s.price || 0), 0);

  const Stat = ({ icon: Icon, value, label, tone }: { icon: LucideIcon; value: string | number; label: string; tone?: string }) => (
    <div className={cn("rounded-[14px] border border-border bg-card p-4 text-card-foreground shadow-sm", tone)}>
      <div className="flex items-center gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-[10px]", tone ? tone.replace("border", "bg").replace("/70", "/40") : "bg-[hsl(var(--brand-50))]")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-[20px] font-bold tabular-nums leading-none">{loading ? "—" : value}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );

  return (
    <SellerLayout title="Склад" subtitle="Остатки и движения товаров">
      <div className="mx-auto max-w-[1320px] space-y-4 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24" role="status" aria-live="polite"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" /><span className="sr-only">Загрузка склада</span></div>
        ) : loadError ? (
          <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 px-5 py-10 text-center" role="alert">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="text-[14px] font-medium text-foreground">{loadError}</p>
            <button type="button" onClick={refresh} className="mt-4 h-11 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Повторить
            </button>
          </div>
        ) : hasSupplier === false ? (
          <div className="rounded-[14px] border border-border bg-card py-16 text-center text-card-foreground">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-[12px] bg-[hsl(var(--brand-50))] text-[hsl(var(--brand-700))]"><Store className="h-6 w-6" /></div>
            <h2 className="text-[18px] font-bold font-display">Сначала создайте витрину</h2>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] text-muted-foreground">Склад строится из ваших товаров — заполните профиль и добавьте позиции.</p>
            <Link to="/seller/profile" className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Перейти к витрине</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="grid grid-cols-2 gap-3 sm:contents">
                <Stat icon={Boxes} value={items.length} label="Всего позиций" />
                <Stat icon={AlertTriangle} value={lowCount} label="Заканчивается" tone="text-destructive" />
                <Stat icon={Package} value={expiringCount} label="Скоро истекает" tone="text-[hsl(var(--warning-amber))]" />
                <Stat icon={TrendingDown} value={`${(totalValue / 1_000_000).toFixed(2)} млн`} label="Стоимость остатков, сум" tone="text-[hsl(var(--success-green))]" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию, бренду, артикулу…"
                  aria-label="Поиск по складу" className="h-11 w-full rounded-[10px] border border-border bg-background pl-9 pr-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <button type="button" onClick={() => setStockOp({ type: "income" })} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-[13.5px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowDownToLine className="h-4 w-4 text-[hsl(var(--success-green))]" aria-hidden="true" /> Поступление
              </button>
              <button type="button" onClick={() => setStockOp({ type: "writeoff" })} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-[13.5px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowUpFromLine className="h-4 w-4 text-destructive" aria-hidden="true" /> Списание
              </button>
              <button type="button" onClick={() => setLogOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-[13.5px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ClipboardList className="h-4 w-4" /> Журнал
              </button>
              <Link to="/seller/products" className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13.5px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Plus className="h-4 w-4" /> Товар
              </Link>
            </div>

            {categories.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    type="button"
                    aria-pressed={cat === activeCategory}
                    className={cn("min-h-11 rounded-[10px] px-3 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      cat === activeCategory ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:bg-muted")}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {(lowCount > 0 || expiringCount > 0) && (
              <div className="flex flex-wrap gap-2">
                {lowCount > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-[12px] border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive" role="status">
                    <AlertTriangle className="h-4 w-4" /> Требует пополнения: <b>{lowCount}</b>
                  </div>
                )}
                {expiringCount > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-[12px] border border-[hsl(var(--warning-amber)/0.3)] bg-[hsl(var(--warning-amber)/0.1)] px-4 py-2.5 text-[13px] text-[hsl(var(--warning-amber))]" role="status">
                    <AlertTriangle className="h-4 w-4" /> Скоро истекает: <b>{expiringCount}</b> (&lt; 30 дней)
                  </div>
                )}
              </div>
            )}

            <div
              className="max-w-full overflow-x-auto rounded-[14px] border border-border bg-card text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              role="region"
              aria-label="Таблица склада"
              tabIndex={0}
            >
              <table className="min-w-[900px] w-full text-[13px]">
                <caption className="sr-only">Остатки товаров на складе продавца</caption>
                <thead className="bg-muted">
                  <tr className="text-left text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-5 py-3">Позиция</th>
                    <th scope="col" className="px-3 py-3">Категория</th>
                    <th scope="col" className="px-3 py-3 text-right">Остаток</th>
                    <th scope="col" className="px-3 py-3">Срок годности</th>
                    <th scope="col" className="px-3 py-3">Статус</th>
                    <th scope="col" className="px-3 py-3 text-right">Цена</th>
                    <th scope="col" className="px-3 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center">
                        <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <div className="text-[14px] font-medium text-foreground">{items.length === 0 ? "Склад пуст" : "Ничего не найдено"}</div>
                        <div className="mt-1 text-[12.5px] text-muted-foreground" role="status">
                          {items.length === 0 ? 'Добавьте товары в разделе «Товары» — они появятся здесь' : "Измените поиск или категорию"}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((it) => {
                      const status = stockStatus(it);
                      const meta = STATUS_META[status];
                      return (
                        <tr key={it.id} className="border-t border-border hover:bg-muted/60">
                          <td className="px-5 py-3">
                            <div className="text-[13px] font-semibold text-foreground">{it.name}</div>
                            <div className="text-[12px] text-muted-foreground">{[it.brand, it.sku].filter(Boolean).join(" · ") || "—"}</div>
                          </td>
                          <td className="px-3 py-3 text-[12.5px] text-muted-foreground">{it.category || "—"}</td>
                          <td className="px-3 py-3 text-right">
                            <div className="text-[13px] font-semibold tabular-nums text-foreground">
                              {it.stock_quantity ?? 0} <span className="text-[12px] font-normal text-muted-foreground">{it.unit || "шт"}</span>
                            </div>
                            <div className="text-[12px] tabular-nums text-muted-foreground">мин {it.min_quantity ?? 0}</div>
                          </td>
                          <td className="px-3 py-3 text-[12.5px] tabular-nums text-muted-foreground">
                            {it.expiry_date ? new Date(it.expiry_date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset", meta.cls)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} /> {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-[12.5px] text-foreground">{fmt(it.price)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" aria-label={`Поступление: ${it.name}`} onClick={() => setStockOp({ type: "income", productId: it.id })} className="grid h-11 w-11 place-items-center rounded-[8px] text-[hsl(var(--success-green))] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <ArrowDownToLine className="h-4 w-4" />
                              </button>
                              <button type="button" aria-label={`Списание: ${it.name}`} onClick={() => setStockOp({ type: "writeoff", productId: it.id })} className="grid h-11 w-11 place-items-center rounded-[8px] text-destructive hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <ArrowUpFromLine className="h-4 w-4" />
                              </button>
                              <button type="button" aria-label={`Порог и срок годности: ${it.name}`} onClick={() => setThresholdItem(it)} className="grid h-11 w-11 place-items-center rounded-[8px] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <Settings2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div className="border-t border-border px-5 py-2.5 text-[12px] text-muted-foreground" aria-live="polite">
                Показано <b className="tabular-nums text-foreground">{filtered.length}</b> из {items.length}
              </div>
            </div>
          </>
        )}
      </div>

      <StockDialog open={!!stockOp} products={items} initial={stockOp} onClose={() => setStockOp(null)} onDone={refresh} />
      <ThresholdDialog product={thresholdItem} onClose={() => setThresholdItem(null)} onDone={refresh} />
      <MovementLog open={logOpen} onClose={() => setLogOpen(false)} />
    </SellerLayout>
  );
};

export default SellerWarehouse;
