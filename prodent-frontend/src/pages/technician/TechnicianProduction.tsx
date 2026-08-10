import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  FlaskConical,
  Loader2,
  Wrench,
} from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { DesignCard, DesignBadge } from "@/components/design";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { lab, type LabOrder, type LabOrderStatus } from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";
import { cn } from "@/lib/utils";

// ── Status model (mirrors TechnicianOrders / TechnicianOrder) ────────────────
const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  queued: "Очередь",
  model: "Модель",
  wax: "Восковка",
  milling: "Фрезеровка",
  frame: "Каркас",
  glaze: "Глазуровка",
  ready: "Готов",
  delivered: "Выдан",
  cancelled: "Отменён",
  declined: "Отклонён",
};

// Forward flow: queued → … → ready → delivered. delivered/cancelled/declined terminal.
const FLOW: LabOrderStatus[] = ["queued", "model", "wax", "milling", "frame", "glaze", "ready"];

// Columns rendered on the board, in order (active stages only — no terminal;
// incoming 'new' orders live on the Orders page until accepted).
const COLUMNS: LabOrderStatus[] = ["queued", "model", "wax", "milling", "frame", "glaze", "ready"];
const TERMINAL = new Set<LabOrderStatus>(["delivered", "cancelled", "declined"]);

const STATUS_TONE: Record<string, "neutral" | "teal" | "amber" | "rose" | "emerald" | "sky" | "violet"> = {
  queued: "neutral",
  model: "violet",
  wax: "amber",
  milling: "teal",
  frame: "sky",
  glaze: "violet",
  ready: "emerald",
  delivered: "emerald",
  cancelled: "rose",
};

function nextStatusOf(status: LabOrderStatus): LabOrderStatus | null {
  if (TERMINAL.has(status)) return null;
  const idx = FLOW.indexOf(status);
  if (idx < 0 || idx >= FLOW.length - 1) return null;
  return FLOW[idx + 1];
}

function labelOf(status: string | null): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Relative day hint for a YYYY-MM-DD due date (same logic as TechnicianOrders).
function dueHint(due: string | null): { label: string; tone: "danger" | "warn" | "muted" } {
  if (!due) return { label: "без срока", tone: "muted" };
  const today = new Date(todayIso() + "T00:00:00");
  const d = new Date(due.slice(0, 10) + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: `просрочен на ${-diff} дн.`, tone: "danger" };
  if (diff === 0) return { label: "сегодня", tone: "danger" };
  if (diff === 1) return { label: "завтра", tone: "warn" };
  return { label: `через ${diff} дн.`, tone: "muted" };
}

export default function TechnicianProduction() {
  const { toast } = useToast();

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-order advance lock (so only the clicked card's button is disabled).
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await lab.listOrders();
      // Board shows production stages only ('new' waits on the Orders page).
      setOrders(all.filter((o) => COLUMNS.includes(o.status)));
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Не удалось загрузить производство"));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Group active orders by status, sorted within a column by due date.
  const byStatus = useMemo(() => {
    const map: Record<string, LabOrder[]> = {};
    for (const s of COLUMNS) map[s] = [];
    for (const o of orders) {
      if (map[o.status]) map[o.status].push(o);
    }
    for (const s of COLUMNS) {
      map[s].sort((a, b) => {
        const ad = a.due_date ? String(a.due_date).slice(0, 10) : "9999-99-99";
        const bd = b.due_date ? String(b.due_date).slice(0, 10) : "9999-99-99";
        return ad < bd ? -1 : ad > bd ? 1 : 0;
      });
    }
    return map;
  }, [orders]);

  const advance = async (o: LabOrder) => {
    const cur = o.status;
    const next = nextStatusOf(cur);
    if (!next || advancingId) return;
    setAdvancingId(o.id);
    try {
      // The server validates the step against the current status and writes the
      // event atomically; passing `to` guards against a stale board double-click.
      await lab.advanceOrder(o.id, next);

      toast({
        title: next === "delivered" ? "Заказ выдан" : "Этап обновлён",
        description:
          next === "delivered"
            ? "Заказ перемещён в архив."
            : `Статус: ${labelOf(next)}`,
      });
      await load();
    } catch (error: unknown) {
      toast({
        title: "Не удалось обновить этап",
        description: getErrorMessage(error, "Попробуйте ещё раз."),
        variant: "destructive",
      });
    } finally {
      setAdvancingId(null);
    }
  };

  const total = orders.length;

  return (
    <TechnicianLayout
      title="Производство"
      subtitle={`Канбан по этапам · ${total} в работе`}
    >
      <div className="p-4 sm:p-6 lg:p-8">
        {loading ? (
          <DesignCard className="flex items-center justify-center gap-2 py-20 text-[13.5px] text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Загрузка производства…
          </DesignCard>
        ) : error ? (
          <DesignCard className="flex flex-col items-center justify-center gap-3 py-20 text-center" role="alert">
            <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-[14px] font-semibold text-foreground">Не удалось загрузить производство</div>
            <div className="max-w-sm text-[12.5px] text-muted-foreground">{error}</div>
            <Button variant="outline" size="sm" onClick={load}>
              Повторить
            </Button>
          </DesignCard>
        ) : total === 0 ? (
          <DesignCard className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <div className="w-11 h-11 rounded-[12px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))]">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="text-[14px] font-semibold text-foreground">Нет заказов в работе</div>
            <div className="text-[12.5px] text-muted-foreground">
              Создайте заказ на странице «Заказы» — он появится в очереди.
            </div>
          </DesignCard>
        ) : (
          <div
            className="flex gap-4 overflow-x-auto rounded-[12px] pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="region"
            aria-label="Этапы производства"
            tabIndex={0}
          >
            {COLUMNS.map((stage) => {
              const cards = byStatus[stage] ?? [];
              return (
                <div key={stage} className="shrink-0 w-[280px] flex flex-col">
                  {/* Column header */}
                  <div className="flex items-center justify-between gap-2 px-1 mb-3">
                    <div className="flex items-center gap-2">
                      <DesignBadge tone={STATUS_TONE[stage] ?? "neutral"}>
                        <Wrench className="w-3 h-3" /> {STATUS_LABELS[stage]}
                      </DesignBadge>
                    </div>
                    <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                      {cards.length}
                    </span>
                  </div>

                  {/* Column body */}
                  <div className="min-h-[120px] flex-1 space-y-3 rounded-[14px] border border-border bg-muted/40 p-2.5">
                    {cards.length === 0 ? (
                      <div className="text-[12px] text-muted-foreground text-center py-8">
                        Пусто
                      </div>
                    ) : (
                      cards.map((o) => {
                        const hint = dueHint(o.due_date);
                        const next = nextStatusOf(o.status);
                        const isAdvancing = advancingId === o.id;
                        return (
                          <article
                            key={o.id}
                            className="rounded-[12px] border border-border bg-card p-3 transition-colors hover:border-primary/40"
                          >
                            <Link
                              to={`/technician/order?id=${o.id}`}
                              className="block rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                                  {o.order_number != null
                                    ? `№${o.order_number}`
                                    : String(o.id).slice(0, 6)}
                                </div>
                                {o.priority === "urgent" && (
                                  <DesignBadge tone="rose">Срочно</DesignBadge>
                                )}
                              </div>

                              <div className="mt-1.5 truncate text-[13.5px] font-medium text-foreground">
                                {o.patient_name || "Без пациента"}
                              </div>

                              <div className="mt-1 truncate text-xs text-foreground/80">
                                {o.work_type}
                              </div>
                              {o.material && (
                                <div className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                                  <FlaskConical className="h-3 w-3 shrink-0" aria-hidden="true" /> {o.material}
                                </div>
                              )}
                            </Link>

                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <div
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-medium",
                                  hint.tone === "danger" && "text-destructive",
                                  hint.tone === "warn" && "text-[hsl(var(--warning-amber))]",
                                  hint.tone === "muted" && "text-muted-foreground",
                                )}
                              >
                                <Clock className="w-3 h-3" /> {hint.label}
                              </div>

                              <button
                                type="button"
                                disabled={isAdvancing || !next}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  advance(o);
                                }}
                                title={
                                  next === "delivered"
                                    ? "Выдать заказ"
                                    : `Следующий этап: ${labelOf(next)}`
                                }
                                className={cn(
                                  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-[8px] px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  "bg-[hsl(var(--brand-50))] text-[hsl(var(--brand-700))] hover:bg-[hsl(var(--brand-50))]/70",
                                  "disabled:opacity-50 disabled:cursor-not-allowed",
                                )}
                              >
                                {isAdvancing ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    {next === "delivered" ? "Выдать" : "Далее"}
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
