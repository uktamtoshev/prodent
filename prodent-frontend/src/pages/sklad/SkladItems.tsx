import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ClipboardCheck,
  Download,
  MoveRight,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sklad, type SkladItem, type SkladStats, type SkladCategory, type StockOpType } from "@/lib/sklad";
import {
  InventoryCountDialog,
  ItemDialog,
  StockDialog,
  TransferDialog,
} from "@/components/sklad/SkladShared";
import { stockStatus, STATUS_META } from "@/components/sklad/sklad-status";
import { useSkladPermissions } from "@/hooks/useSkladPermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatAmount, formatDate } from "@/lib/localization";

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "destructive";
}) {
  return (
    <div
      className={cn(
        "rounded-prodent border bg-card p-4 shadow-design-card",
        tone === "warning" && "border-warning/30",
        tone === "destructive" && "border-destructive/30",
        tone === "default" && "border-border",
      )}
    >
      <div
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive",
          tone === "default" && "text-muted-foreground",
        )}
      >
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function SkladItems() {
  const { language, t } = useLanguage();
  const { canManageCatalog, canMutateStock } = useSkladPermissions();
  const [items, setItems] = useState<SkladItem[]>([]);
  const [stats, setStats] = useState<SkladStats | null>(null);
  const [categories, setCategories] = useState<SkladCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "low">("all");
  const [activeCat, setActiveCat] = useState<string>("");

  const [itemDialog, setItemDialog] = useState(false);
  const [editItem, setEditItem] = useState<SkladItem | null>(null);
  const [stockType, setStockType] = useState<StockOpType | null>(null);
  const [stockPreselect, setStockPreselect] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [it, st, cats] = await Promise.all([
        sklad.listItems(),
        sklad.stats(),
        sklad.listCategories(),
      ]);
      setItems(it);
      setStats(st);
      setCategories(cats);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : undefined) || t("sklad.loadError"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchQ =
        !q ||
        it.name.toLowerCase().includes(q) ||
        (it.brand?.toLowerCase().includes(q) ?? false) ||
        (it.sku?.toLowerCase().includes(q) ?? false) ||
        (it.supplier?.toLowerCase().includes(q) ?? false);
      const matchCat = !activeCat || it.category_id === activeCat;
      /**
       * Срез «Заканчивается» по макету. Порог — то же правило, по которому
       * считается предупреждение внизу экрана: позиция кончается, когда её
       * остаток не выше минимального. Оба поля приходят в самой позиции,
       * отдельный запрос не нужен.
       */
      const matchTab = tab === "all" || Number(it.quantity) <= Number(it.min_quantity);
      return matchQ && matchCat && matchTab;
    });
  }, [items, query, activeCat, tab]);

  const remove = async (it: SkladItem) => {
    if (!window.confirm(`${t("sklad.deleteConfirm")} «${it.name}»?`)) return;
    try {
      await sklad.deleteItem(it.id);
      toast.success(t("sklad.itemDeleted"));
      load();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : undefined) || t("sklad.deleteError"));
    }
  };

  const money = (n: number) => formatAmount(n, language);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground">
            <Boxes className="h-6 w-6 text-brand" />
            {t("sklad.title")}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("sklad.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMutateStock && (
            <>
          <button
            onClick={() => { setStockPreselect(null); setStockType("income"); }}
            className="inline-flex h-9 items-center gap-2 rounded-prodent-btn border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
          >
            <ArrowDownToLine className="h-4 w-4 text-success" /> {t("sklad.income")}
          </button>
          <button
            onClick={() => { setStockPreselect(null); setStockType("expense"); }}
            className="inline-flex h-9 items-center gap-2 rounded-prodent-btn border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
          >
            <ArrowUpFromLine className="h-4 w-4 text-destructive" /> {t("sklad.expense")}
          </button>
          <button
            onClick={() => { setStockPreselect(null); setStockType("adjustment"); }}
            className="inline-flex h-9 items-center gap-2 rounded-prodent-btn border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
          >
            <SlidersHorizontal className="h-4 w-4 text-tashkent-sky" /> {t("sklad.adjustment")}
          </button>
          <button
            onClick={() => { setStockPreselect(null); setTransferOpen(true); }}
            className="inline-flex h-9 items-center gap-2 rounded-prodent-btn border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
          >
            <MoveRight className="h-4 w-4 text-tashkent-sky" /> {t("sklad.transfer")}
          </button>
          <button
            onClick={() => { setStockPreselect(null); setCountOpen(true); }}
            className="inline-flex h-9 items-center gap-2 rounded-prodent-btn border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
          >
            <ClipboardCheck className="h-4 w-4 text-brand" /> {t("sklad.inventoryCount")}
          </button>
            </>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                const blob = await sklad.exportCsv();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "sklad-export.csv";
                link.click();
                URL.revokeObjectURL(url);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("sklad.exportError"),
                );
              }
            }}
            className="inline-flex h-9 items-center gap-2 rounded-prodent-btn border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
          >
            <Download className="h-4 w-4" /> {t("sklad.export")}
          </button>
          {canManageCatalog && (
            <button
              onClick={() => { setEditItem(null); setItemDialog(true); }}
              className="inline-flex h-9 items-center gap-2 rounded-prodent-btn bg-brand px-3.5 text-sm font-semibold text-white shadow-design-btn transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> {t("sklad.addItem")}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("sklad.statItems")} value={loading ? "—" : String(stats?.total_items ?? 0)} />
        <StatCard
          label={t("sklad.statLow")}
          tone="destructive"
          value={loading ? "—" : String(stats?.low_stock ?? 0)}
          hint={t("sklad.belowMinimum")}
        />
        <StatCard
          label={t("sklad.statExpiring")}
          tone="warning"
          value={loading ? "—" : String(stats?.expiring ?? 0)}
          hint={t("sklad.within30Days")}
        />
        <StatCard
          label={t("sklad.warehouseValue")}
          value={loading ? "—" : `${money(Number(stats?.total_value ?? 0))} ${t("sklad.currencyUzs")}`}
        />
      </div>

      {/* Вкладки склада. «Заканчивается» — реальный срез по остатку и минимуму,
          оба поля приходят в позиции. Разделение «склад клиники / личный склад»
          из макета здесь не сделано намеренно: область склада задаётся на
          сервере, переключателя на клиенте для неё нет. */}
      <div className="flex flex-wrap items-center gap-0.5">
        {([
          { key: "all" as const, label: t("sklad.tabAll") },
          { key: "low" as const, label: t("sklad.statLow") },
        ]).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={cn(
              "cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === item.key
                ? "border border-b-0 border-border bg-card font-semibold text-brand shadow-design-card"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.key === "low" && (stats?.low_stock ?? 0) > 0 && (
              <span className="rounded-full bg-status-warning-bg px-1.5 text-xs font-bold tabular-nums text-status-warning">
                {stats?.low_stock}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("sklad.searchPlaceholder")}
            aria-label={t("sklad.searchPlaceholder")}
            className="h-10 w-full rounded-prodent-input border border-border bg-card pl-9 pr-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCat("")}
            className={cn(
              "h-8 rounded-prodent-input px-3 text-xs font-medium transition",
              !activeCat ? "bg-brand-50 text-brand-700" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t("sklad.all")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={cn(
                "h-8 rounded-prodent-input px-3 text-xs font-medium transition",
                activeCat === c.id ? "bg-brand-50 text-brand-700" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-prodent border border-border bg-card shadow-design-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">{t("sklad.tableItem")}</th>
              <th className="px-3 py-3">{t("sklad.tableCategory")}</th>
              <th className="px-3 py-3 text-right">{t("sklad.tableStock")}</th>
              <th className="px-3 py-3">{t("sklad.tableExpiry")}</th>
              <th className="px-3 py-3">{t("sklad.tableStatus")}</th>
              <th className="px-3 py-3 text-right">{t("sklad.tablePrice")}</th>
              <th className="px-3 py-3 text-right">{t("sklad.tableActions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t("sklad.loading")}</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <Boxes className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <div className="font-medium text-foreground">
                    {items.length === 0 ? t("sklad.emptyWarehouse") : t("sklad.nothingFound")}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {items.length === 0 ? t("sklad.addFirstItem") : t("sklad.changeFilters")}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const status = stockStatus(it);
                const meta = STATUS_META[status];
                return (
                  <tr key={it.id} className="border-t border-border/70 transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{it.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[it.brand, it.sku].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{it.category || "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-semibold tabular-nums text-foreground">
                        {Number(it.quantity)} <span className="text-xs font-normal text-muted-foreground">{it.unit}</span>
                      </div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">{t("sklad.minimum")} {Number(it.min_quantity) || 0}</div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {it.expiry_date
                        ? formatDate(it.expiry_date, language, { day: "2-digit", month: "short", year: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", meta.cls)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        {t(meta.key)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {it.price_per_unit ? money(Number(it.price_per_unit)) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canMutateStock && (
                          <>
                        <button
                          onClick={() => { setStockPreselect(it.id); setStockType("income"); }}
                          title={t("sklad.income")}
                          className="grid h-8 w-8 place-items-center rounded-prodent-input text-success transition hover:bg-success/10"
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setStockPreselect(it.id); setStockType("expense"); }}
                          title={t("sklad.expense")}
                          className="grid h-8 w-8 place-items-center rounded-prodent-input text-destructive transition hover:bg-destructive/10"
                        >
                          <ArrowUpFromLine className="h-4 w-4" />
                        </button>
                          </>
                        )}
                        {canManageCatalog && (
                          <>
                        <button
                          onClick={() => { setEditItem(it); setItemDialog(true); }}
                          title={t("sklad.edit")}
                          className="grid h-8 w-8 place-items-center rounded-prodent-input text-muted-foreground transition hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(it)}
                          title={t("sklad.delete")}
                          className="grid h-8 w-8 place-items-center rounded-prodent-input text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
            {t("sklad.shown")} <b className="tabular-nums text-foreground">{filtered.length}</b> {t("sklad.of")} {items.length}
          </div>
        )}
      </div>

      {/* Low-stock banner */}
      {!loading && stats && stats.low_stock > 0 && (
        <div className="flex items-center gap-2 rounded-prodent border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-foreground">
            {t("sklad.lowStockWarning")}: {stats.low_stock}
          </span>
        </div>
      )}

      <ItemDialog
        open={itemDialog}
        onOpenChange={(o) => { setItemDialog(o); if (!o) setEditItem(null); }}
        onSaved={load}
        editItem={editItem}
      />
      <StockDialog
        open={stockType !== null}
        onOpenChange={(o) => { if (!o) { setStockType(null); setStockPreselect(null); } }}
        onDone={load}
        type={stockType || "income"}
        items={items}
        preselectedId={stockPreselect}
      />
      <TransferDialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) setStockPreselect(null);
        }}
        onDone={load}
        items={items}
        preselectedId={stockPreselect}
      />
      <InventoryCountDialog
        open={countOpen}
        onOpenChange={(open) => {
          setCountOpen(open);
          if (!open) setStockPreselect(null);
        }}
        onDone={load}
        items={items}
        preselectedId={stockPreselect}
      />
    </div>
  );
}
