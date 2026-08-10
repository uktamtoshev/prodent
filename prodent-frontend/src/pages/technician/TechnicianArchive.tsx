import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Archive as ArchiveIcon,
  ChevronRight,
  FlaskConical,
  Loader2,
  Search,
} from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { DesignCard, DesignBadge } from "@/components/design";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { lab, type LabOrder, type LabOrderStatus } from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";
import { cn } from "@/lib/utils";

// Terminal statuses shown in the archive.
const TERMINAL = new Set<LabOrderStatus>(["delivered", "cancelled", "declined"]);

type FilterKey = "all" | "delivered" | "cancelled" | "declined";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "delivered", label: "Выданные" },
  { key: "cancelled", label: "Отменённые" },
  { key: "declined", label: "Отклонённые" },
];

// Завершён column — short date+time for updated_at (mirrors order-page format).
function formatDone(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default function TechnicianArchive() {
  const { toast } = useToast();

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await lab.listOrders();
      const archived = all
        .filter((o) => TERMINAL.has(o.status))
        .sort((a, b) => {
          const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bt - at; // newest first
        });
      setOrders(archived);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Не удалось загрузить архив"));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!q) return true;
      const hay = [
        o.patient_name,
        o.work_type,
        o.order_number != null ? `№${o.order_number}` : "",
        o.order_number != null ? String(o.order_number) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, filter, query]);

  const counts = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const declined = orders.filter((o) => o.status === "declined").length;
    return { all: orders.length, delivered, cancelled, declined };
  }, [orders]);

  // Surface a fetch error once (parity with other technician pages).
  useEffect(() => {
    if (error) {
      toast({
        title: "Ошибка загрузки архива",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <TechnicianLayout
      title="Архив"
      subtitle={`Завершённые заказы · ${counts.all}`}
    >
      <div className="mx-auto max-w-[1320px] p-4 sm:p-6 lg:p-8">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div
            className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[12px] bg-muted p-1"
            role="group"
            aria-label="Фильтр архива"
          >
            {FILTERS.map((f) => {
              const n = counts[f.key];
              const activeBtn = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={activeBtn}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeBtn
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span className="text-xs tabular-nums text-muted-foreground">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="relative sm:ml-auto sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: пациент, работа, №"
              className="pl-9"
            />
          </div>
        </div>

        <DesignCard pad="p-0">
          <div className="hidden grid-cols-[80px,1fr,1fr,120px,140px,44px] border-b border-border bg-muted/40 px-5 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground md:grid">
            <div>№</div>
            <div>Пациент</div>
            <div>Работа</div>
            <div>Статус</div>
            <div>Завершён</div>
            <div></div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13.5px] text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Загрузка архива…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
              <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="text-[13.5px] font-medium text-foreground">Не удалось загрузить архив</div>
              <div className="max-w-sm text-xs text-muted-foreground">{error}</div>
              <Button variant="outline" size="sm" onClick={load}>
                Повторить
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="w-11 h-11 rounded-[12px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))]">
                <ArchiveIcon className="w-5 h-5" />
              </div>
              <div className="text-[14px] font-semibold text-foreground">Архив пуст</div>
              <div className="text-[12.5px] text-muted-foreground">
                Здесь появятся выданные и отменённые заказы.
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-muted text-muted-foreground">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="text-[14px] font-semibold text-foreground">Ничего не найдено</div>
              <div className="text-[12.5px] text-muted-foreground">Измените фильтр или поисковый запрос.</div>
            </div>
          ) : (
            visible.map((o) => (
              <Link
                key={o.id}
                to={`/technician/order?id=${o.id}`}
                className="grid min-h-11 grid-cols-1 items-center gap-2 border-b border-border px-4 py-4 text-[13px] last:border-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 md:grid-cols-[80px_1fr_1fr_120px_140px_44px] md:gap-0"
              >
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {o.order_number != null ? `№${o.order_number}` : String(o.id).slice(0, 6)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">
                    {o.patient_name || "Без пациента"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{o.work_type}</div>
                  {o.material && (
                    <div className="mt-0.5 inline-flex truncate text-xs text-muted-foreground">
                      <FlaskConical className="w-3 h-3 shrink-0" /> {o.material}
                    </div>
                  )}
                </div>
                <div>
                  <DesignBadge tone={o.status === "delivered" ? "emerald" : "rose"}>
                    {o.status === "delivered" ? "Выдан" : o.status === "declined" ? "Отклонён" : "Отменён"}
                  </DesignBadge>
                </div>
                <div className="text-[12.5px] tabular-nums text-foreground">
                  {formatDone(o.updated_at)}
                </div>
                <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" aria-hidden="true" />
              </Link>
            ))
          )}
        </DesignCard>

        {!loading && !error && visible.length > 0 && (
          <div className="mt-3 px-1 text-xs text-muted-foreground" aria-live="polite">
            Показано {visible.length} из {orders.length}
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
