import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Boxes,
  Loader2,
  Minus,
  Package,
  Plus,
} from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { DesignCard, DesignBadge, SectionTitle } from "@/components/design";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { lab, type LabMaterial } from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";
import { cn } from "@/lib/utils";
import { clearPersistentClientRequestId, getPersistentClientRequestId } from "@/lib/crm-operations-api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Helpers ───────────────────────────────────────────────────────────────
function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function isLow(m: LabMaterial): boolean {
  return toNum(m.stock_qty) <= toNum(m.min_qty);
}

// Compact numeric display: drop trailing ".0" but keep real fractions.
function fmtQty(v: unknown): string {
  const n = toNum(v);
  return Number.isInteger(n) ? String(n) : String(n);
}

// UZS money with thousands separators + ' сум'.
function fmtUzs(v: number): string {
  const rounded = Math.round(v);
  return `${rounded.toLocaleString("ru-RU").replace(/\u00a0/g, " ")} сум`;
}

function fmtCost(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = toNum(v);
  return fmtUzs(n);
}

interface NewMaterialForm {
  name: string;
  category: string;
  unit: string;
  stock_qty: string;
  min_qty: string;
  unit_cost: string;
  supplier: string;
  notes: string;
}

const EMPTY_FORM: NewMaterialForm = {
  name: "",
  category: "",
  unit: "шт",
  stock_qty: "0",
  min_qty: "0",
  unit_cost: "",
  supplier: "",
  notes: "",
};

export default function TechnicianMaterials() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const uz = language === "uz";
  const { toast } = useToast();

  const [materials, setMaterials] = useState<LabMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewMaterialForm>(EMPTY_FORM);
  const [nameTouched, setNameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // id of the row currently being saved (stock +/-), for per-row disabling.
  const [savingId, setSavingId] = useState<string | null>(null);
  const pendingAdjustmentSync = useRef<{
    actor: string;
    scope: string;
    action: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Owner-scoped: the server returns only this technician's stock.
      const all = await lab.listMaterials();
      // Sort: low-stock first, then by name (RU-aware).
      all.sort((a, b) => {
        const la = isLow(a) ? 0 : 1;
        const lb = isLow(b) ? 0 : 1;
        if (la !== lb) return la - lb;
        return String(a.name || "").localeCompare(String(b.name || ""), "ru");
      });
      setMaterials(all);
      if (pendingAdjustmentSync.current) {
        const pending = pendingAdjustmentSync.current;
        clearPersistentClientRequestId(pending.actor, pending.scope, pending.action);
        pendingAdjustmentSync.current = null;
      }
      return true;
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Не удалось загрузить материалы"));
      setMaterials([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => {
    const count = materials.length;
    const lowCount = materials.filter(isLow).length;
    const stockValue = materials.reduce(
      (sum, m) => sum + toNum(m.stock_qty) * toNum(m.unit_cost),
      0,
    );
    return { count, lowCount, stockValue };
  }, [materials]);

  const setField = (k: keyof NewMaterialForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Persist a stock delta (+1 / -1), guarding against negatives.
  const adjustStock = async (m: LabMaterial, delta: number) => {
    const current = toNum(m.stock_qty);
    const next = current + delta;
    if (next < 0) return;
    setSavingId(m.id);
    try {
      const reason = delta > 0 ? "manual receipt" : "manual consumption";
      const action = `lab-material:${m.id}:${delta}:${current}`;
      const actor = user?.id ?? "anonymous";
      const clientRequestId = getPersistentClientRequestId(actor, "lab-materials", action);
      await lab.adjustMaterial(m.id, { delta, reason, client_request_id: clientRequestId });
      pendingAdjustmentSync.current = {
        actor,
        scope: "lab-materials",
        action,
      };
      const refreshed = await load();
      if (!refreshed) {
        toast({
          title: "Остаток изменён",
          description: "Список не обновился. Повторите только загрузку материалов.",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Не удалось обновить остаток",
        description: getErrorMessage(error, "Попробуйте ещё раз."),
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSubmit = async () => {
    if (loading || error) return;
    if (!form.name.trim()) {
      setNameTouched(true);
      toast({
        title: "Укажите название",
        description: "Поле «Название» обязательно.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await lab.createMaterial({
        name: form.name.trim(),
        category: form.category.trim() || null,
        unit: form.unit.trim() || "шт",
        stock_qty: form.stock_qty ? Number(form.stock_qty) : 0,
        min_qty: form.min_qty ? Number(form.min_qty) : 0,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
      });

      toast({ title: "Материал добавлен", description: "Новая позиция на складе." });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (error: unknown) {
      toast({
        title: "Не удалось добавить материал",
        description: getErrorMessage(error, "Попробуйте ещё раз."),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const lowSubtitle =
    kpis.lowCount > 0 ? `${kpis.lowCount} заканчивается` : "запасы в норме";

  return (
    <TechnicianLayout
      title={uz ? "Materiallar" : "Материалы"}
      subtitle={`Склад · ${materials.length} позиций · ${lowSubtitle}`}
    >
      <div className="mx-auto max-w-[1320px] p-4 sm:p-6 lg:p-8">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <DesignCard pad="p-4">
            <div className="text-xs font-medium text-muted-foreground">Позиций</div>
            <div className="mt-2 text-[24px] font-bold tabular-nums font-display leading-none text-foreground">
              {loading ? "—" : kpis.count}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">всего на складе</div>
          </DesignCard>

          <DesignCard pad="p-4">
            <div className="text-xs font-medium text-muted-foreground">Заканчивается</div>
            <div
              className={cn(
                "mt-2 text-[24px] font-bold tabular-nums font-display leading-none",
                !loading && kpis.lowCount > 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {loading ? "—" : kpis.lowCount}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">ниже порога заказа</div>
          </DesignCard>

          <DesignCard pad="p-4">
            <div className="text-xs font-medium text-muted-foreground">Стоимость склада</div>
            <div className="mt-2 text-[24px] font-bold tabular-nums font-display leading-none text-foreground">
              {loading ? "—" : fmtUzs(kpis.stockValue)}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">остаток × цена/ед</div>
          </DesignCard>
        </div>

        <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle subtitle={uz ? "kam qolganlari birinchi" : "заканчивающиеся — первыми"}>{uz ? "Material zaxiralari" : "Запасы материалов"}</SectionTitle>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={loading || !!error}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            style={{
              background: "hsl(var(--brand))",
              boxShadow:
                "0 1px 2px rgba(13,148,136,0.25), 0 4px 12px -2px rgba(13,148,136,0.35)",
            }}
          >
            <Plus className="w-4 h-4" /> {uz ? "Material qo‘shish" : "Добавить материал"}
          </button>
        </div>

        <DesignCard
          pad="p-0"
          className="overflow-x-auto"
          role="region"
          aria-label={uz ? "Materiallar jadvali" : "Таблица материалов"}
          tabIndex={0}
        >
          <div role="table" aria-label={uz ? "Materiallar" : "Материалы"}>
            <div role="row" className="grid min-w-[900px] grid-cols-[1.4fr,1fr,150px,90px,110px,1fr,1fr] border-b border-border bg-muted/40 px-5 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <div role="columnheader">{uz ? "Nomi" : "Название"}</div>
            <div role="columnheader">{uz ? "Toifa" : "Категория"}</div>
            <div role="columnheader">{uz ? "Qoldiq" : "Остаток"}</div>
            <div role="columnheader">Мин.</div>
            <div role="columnheader">{uz ? "Holat" : "Статус"}</div>
            <div role="columnheader">{uz ? "Narx/birlik" : "Цена/ед"}</div>
            <div role="columnheader">{uz ? "Yetkazib beruvchi" : "Поставщик"}</div>
            </div>

            {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13.5px] text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Загрузка материалов…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
              <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="text-[13.5px] text-foreground font-medium">
                Не удалось загрузить материалы
              </div>
              <div className="max-w-sm text-xs text-muted-foreground">{error}</div>
              <Button variant="outline" size="sm" onClick={load} className="min-h-11">
                Повторить
              </Button>
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center" role="status">
              <div className="w-11 h-11 rounded-[12px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))]">
                <Boxes className="w-5 h-5" />
              </div>
              <div className="text-[14px] text-foreground font-semibold">Склад пуст</div>
              <div className="text-[12.5px] text-muted-foreground">
                Материалов пока нет — добавьте первую позицию.
              </div>
            </div>
          ) : (
            materials.map((m) => {
              const low = isLow(m);
              const rowSaving = savingId === m.id;
              const stock = toNum(m.stock_qty);
              return (
                <div
                  key={m.id}
                  role="row"
                  className="grid min-w-[900px] grid-cols-[1.4fr,1fr,150px,90px,110px,1fr,1fr] text-[13px] px-5 py-4 border-b border-border last:border-0 items-center hover:bg-muted/40"
                >
                  <div role="cell" className="min-w-0">
                    <div className="font-semibold text-foreground truncate flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      {m.name || "Без названия"}
                    </div>
                    {m.notes && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {m.notes}
                      </div>
                    )}
                  </div>
                  <div role="cell" className="text-[12.5px] text-muted-foreground truncate">
                    {m.category || "—"}
                  </div>
                  <div role="cell" className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustStock(m, -1)}
                      disabled={rowSaving || stock <= 0}
                      aria-label="Уменьшить остаток"
                      className="grid h-11 w-11 place-items-center rounded-[8px] border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="min-w-[64px] text-center tabular-nums font-medium text-foreground">
                      {rowSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                      ) : (
                        `${fmtQty(m.stock_qty)} ${m.unit || ""}`.trim()
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustStock(m, 1)}
                      disabled={rowSaving}
                      aria-label="Увеличить остаток"
                      className="grid h-11 w-11 place-items-center rounded-[8px] border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div role="cell" className="tabular-nums text-muted-foreground">{fmtQty(m.min_qty)}</div>
                  <div role="cell">
                    {low ? (
                      <DesignBadge tone="rose">Мало</DesignBadge>
                    ) : (
                      <DesignBadge tone="emerald">В норме</DesignBadge>
                    )}
                  </div>
                  <div role="cell" className="tabular-nums text-foreground truncate">{fmtCost(m.unit_cost)}</div>
                  <div role="cell" className="text-[12.5px] text-muted-foreground truncate">
                    {m.supplier || "—"}
                  </div>
                </div>
              );
            })
            )}
          </div>
        </DesignCard>
      </div>

      {/* New material dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (submitting) return;
          setDialogOpen(o);
          if (!o) {
            setNameTouched(false);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить материал</DialogTitle>
            <DialogDescription>Новая позиция появится на складе.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">
                Название <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                onBlur={() => setNameTouched(true)}
                aria-invalid={nameTouched && !form.name.trim()}
                aria-describedby={nameTouched && !form.name.trim() ? "material-name-error" : undefined}
                placeholder="Диоксид циркония, диск 98 мм"
              />
              {nameTouched && !form.name.trim() && (
                <p id="material-name-error" className="text-xs text-destructive" role="alert">
                  Укажите название
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Категория</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                placeholder="Фрезеровка"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Ед. изм.</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => setField("unit", e.target.value)}
                placeholder="шт"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock_qty">Остаток</Label>
              <Input
                id="stock_qty"
                type="number"
                min="0"
                value={form.stock_qty}
                onChange={(e) => setField("stock_qty", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min_qty">Мин. остаток</Label>
              <Input
                id="min_qty"
                type="number"
                min="0"
                value={form.min_qty}
                onChange={(e) => setField("min_qty", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit_cost">Цена/ед (UZS)</Label>
              <Input
                id="unit_cost"
                type="number"
                min="0"
                value={form.unit_cost}
                onChange={(e) => setField("unit_cost", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="supplier">Поставщик</Label>
              <Input
                id="supplier"
                value={form.supplier}
                onChange={(e) => setField("supplier", e.target.value)}
                placeholder="DentSupply"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Заметки</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Партия, срок годности, особенности хранения…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || loading || !!error || !form.name.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TechnicianLayout>
  );
}
