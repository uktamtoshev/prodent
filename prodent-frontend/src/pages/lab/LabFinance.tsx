import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, HandCoins, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lab, type LabOrder, type LabSettlement } from "@/lib/lab";
import { useLanguage } from "@/contexts/LanguageContext";

// Multi-currency money helpers — orders may be in UZS or USD.
const CUR_LABEL: Record<string, string> = { UZS: "сум", USD: "$" };
const fmtCur = (cur: string, amount: number): string => {
  const a = Math.round(amount).toLocaleString("ru-RU");
  return (cur || "UZS").toUpperCase() === "USD" ? `$${a}` : `${a} ${CUR_LABEL[cur.toUpperCase()] || cur}`;
};
const fmtMoneyMap = (m: Record<string, number>): string => {
  const parts = Object.entries(m)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => fmtCur(c, v));
  return parts.length ? parts.join(" · ") : "0";
};
const fmtDate = (v: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
};

const CANCELLED = new Set(["cancelled", "declined"]);

// Лаборатория › Расчёты (customer side) — the clinic/doctor's settlements and
// debts on their lab orders, grouped by technician. Read-only: computed entirely
// from listOrders (server-scoped to the caller); the technician marks orders paid.
export default function LabFinance() {
  const { language } = useLanguage();
  const uz = language === "uz";
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [settlements, setSettlements] = useState<Record<string, LabSettlement[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextOrders = await lab.listOrders();
      setOrders(nextOrders);
      const ledgerRows = await Promise.all(nextOrders.map(async (order) => [order.id, await lab.listSettlements(order.id)] as const));
      setSettlements(Object.fromEntries(ledgerRows));
    } catch (e: unknown) {
      setError((e instanceof Error ? (e instanceof Error ? e.message : undefined) : undefined) || "Не удалось загрузить расчёты");
      setOrders([]);
      setSettlements({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Billable = not cancelled/declined and has a price.
  const billable = useMemo(
    () => orders.filter((o) => !CANCELLED.has(o.status) && o.price != null),
    [orders],
  );
  const settled = useCallback((order: LabOrder) =>
    (settlements[order.id] || []).reduce((sum, entry) =>
      entry.entry_type === "REFUND" ? sum - Number(entry.amount || 0) : sum + Number(entry.amount || 0), 0),
  [settlements]);
  const remaining = useCallback((order: LabOrder) =>
    Math.max(0, Number(order.price || 0) - settled(order)), [settled]);
  const amountsByCurrency = useCallback((list: LabOrder[], amount: (order: LabOrder) => number) => {
    const result: Record<string, number> = {};
    for (const order of list) {
      const currency = (order.currency || "UZS").toUpperCase();
      result[currency] = (result[currency] || 0) + amount(order);
    }
    return result;
  }, []);

  const kpis = useMemo(() => {
    const debt = billable.filter((o) => o.status === "delivered" && remaining(o) > 0);
    const inWork = billable.filter((o) => o.status !== "delivered" && remaining(o) > 0);
    return {
      paid: amountsByCurrency(billable, settled),
      debt: amountsByCurrency(debt, remaining),
      inWork: amountsByCurrency(inWork, remaining),
    };
  }, [amountsByCurrency, billable, remaining, settled]);

  // Settlements grouped by technician.
  const byTech = useMemo(() => {
    const map = new Map<string, LabOrder[]>();
    for (const o of billable) {
      const key = o.technician_id || o.technician_name || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries())
      .map(([, list]) => ({
        name: list[0].technician_name || "Техник",
        count: list.length,
        paid: amountsByCurrency(list, settled),
        debt: amountsByCurrency(list.filter((o) => o.status === "delivered"), remaining),
      }))
      .sort((a, b) => b.count - a.count);
  }, [amountsByCurrency, billable, remaining, settled]);

  // Outstanding debts: delivered + unpaid.
  const debts = useMemo(
    () =>
      billable
        .filter((o) => o.status === "delivered" && remaining(o) > 0)
        .sort((a, b) => Number(b.order_number ?? 0) - Number(a.order_number ?? 0)),
    [billable, remaining],
  );

  const kpiCards = [
    { label: "Оплачено", value: fmtMoneyMap(kpis.paid), sub: "по заказам", icon: Wallet, tone: "text-emerald-600" },
    { label: "Долг", value: fmtMoneyMap(kpis.debt), sub: "выдано, не оплачено", icon: HandCoins, tone: "text-rose-600" },
    { label: "В работе", value: fmtMoneyMap(kpis.inWork), sub: "ожидается к оплате", icon: Clock, tone: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground">
          <Wallet className="h-6 w-6" />
          {uz ? "Hisob-kitoblar" : "Расчёты"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Оплаты и долги по вашим заказам в лаборатории.
        </p>
      </div>

      {error && !loading && (
        <div className="rounded-prodent-input border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={load}>
            Повторить
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-prodent-card border border-border bg-card p-4 shadow-design-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground/70" />
              </div>
              <div className={`mt-2 text-xl font-bold tabular-nums ${k.tone}`}>{loading ? "—" : k.value}</div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : (
        <>
          {/* Per-technician settlements */}
          <div>
              <h2 className="mb-2 text-sm font-semibold text-foreground">{uz ? "Texniklar bo‘yicha" : "Расчёты по техникам"}</h2>
            <div className="overflow-x-auto rounded-prodent-card border border-border bg-card">
              <div className="grid min-w-[620px] grid-cols-[1fr_80px_1fr_1fr] gap-2 border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <div>{uz ? "Texnik" : "Техник"}</div>
                <div className="text-right">{uz ? "Buyurtmalar" : "Заказов"}</div>
                <div className="text-right">{uz ? "To‘langan" : "Оплачено"}</div>
                <div className="text-right">{uz ? "Qarz" : "Долг"}</div>
              </div>
              {byTech.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">Пока нет заказов с ценой</div>
              ) : (
                byTech.map((g) => (
                  <div
                    key={g.name}
                    className="grid min-w-[620px] grid-cols-[1fr_80px_1fr_1fr] gap-2 border-b border-border px-4 py-3 text-sm last:border-0"
                  >
                    <div className="truncate font-medium text-foreground">{g.name}</div>
                    <div className="text-right tabular-nums text-muted-foreground">{g.count}</div>
                    <div className="text-right tabular-nums font-medium text-emerald-600">{fmtMoneyMap(g.paid)}</div>
                    <div
                      className={`text-right tabular-nums font-semibold ${
                        Object.values(g.debt).some((v) => v > 0) ? "text-rose-600" : "text-muted-foreground"
                      }`}
                    >
                      {fmtMoneyMap(g.debt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Outstanding debts */}
          {debts.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-foreground">{uz ? "To‘lovga" : "К оплате"}</h2>
              <div className="overflow-hidden rounded-prodent-card border border-border bg-card">
                {debts.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {o.order_number != null ? `№${o.order_number} · ` : ""}
                        {o.work_type}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {o.technician_name || "Техник"}
                        {o.patient_name ? ` · ${o.patient_name}` : ""} · выдан {fmtDate(o.updated_at)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-semibold tabular-nums text-rose-600">
                      {fmtCur(o.currency, Number(o.price) || 0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
