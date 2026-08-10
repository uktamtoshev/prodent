import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, HandCoins, Loader2, Search, Wallet } from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { DesignCard } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { lab, type LabOrder } from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";
import { clearPersistentClientRequestId, getPersistentClientRequestId } from "@/lib/crm-operations-api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

// Multi-currency money (orders may be in UZS or USD).
const CUR_LABEL: Record<string, string> = { UZS: "сум", USD: "$" };
const fmtCur = (cur: string, amount: number): string => {
  const a = Math.round(amount).toLocaleString("ru-RU");
  const c = (cur || "UZS").toUpperCase();
  return c === "USD" ? `$${a}` : `${a} ${CUR_LABEL[c] || cur}`;
};
const sumByCurrency = (list: LabOrder[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const o of list) {
    const c = (o.currency || "UZS").toUpperCase();
    m[c] = (m[c] || 0) + (Number(o.price) || 0);
  }
  return m;
};
const fmtMoneyMap = (m: Record<string, number>): string => {
  const parts = Object.entries(m)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => fmtCur(c, v));
  return parts.length ? parts.join(" · ") : "0";
};
const total = (m: Record<string, number>): number => Object.values(m).reduce((s, v) => s + v, 0);

const SELECT_CLS =
  "h-9 rounded-prodent-input border border-border bg-card px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";

type CustomerKindFilter = "all" | "doctor" | "clinic" | "external";
type PaymentStatusFilter = "all" | "debt" | "paid";

function isCustomerKindFilter(value: string): value is CustomerKindFilter {
  return ["all", "doctor", "clinic", "external"].some((option) => option === value);
}

function isPaymentStatusFilter(value: string): value is PaymentStatusFilter {
  return ["all", "debt", "paid"].some((option) => option === value);
}

// Технику › Расчёты — settlements by CUSTOMER (clinic OR individual doctor),
// with filters. Extracted from the Финансы page so debts/payments per врач и
// клиника live on their own page. Reads listOrders; marks orders paid via markPaid.
export default function TechnicianSettlements() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const uz = language === "uz";
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCust, setOpenCust] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<CustomerKindFilter>("all");
  const [status, setStatus] = useState<PaymentStatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await lab.listOrders());
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Не удалось загрузить расчёты"));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mark an order paid / unpaid (optimistic; reverts on error).
  const togglePaid = useCallback(async (o: LabOrder) => {
    const next = !o.paid_at;
    const stamp = next ? new Date().toISOString() : null;
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, paid_at: stamp } : x)));
    try {
      const action = `lab-settlement:${o.id}:${next ? "PAYMENT" : "REFUND"}:${o.price || 0}`;
      const actor = user?.id ?? "anonymous";
      const clientRequestId = getPersistentClientRequestId(actor, o.clinic_id || "lab", action);
      await lab.createSettlement(o.id, {
        entry_type: next ? "PAYMENT" : "REFUND",
        amount: Number(o.price || 0),
        currency: o.currency || "UZS",
        method: "CASH",
        note: next ? "Payment recorded" : "Refund recorded",
        client_request_id: clientRequestId,
      });
      clearPersistentClientRequestId(actor, o.clinic_id || "lab", action);
    } catch {
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, paid_at: o.paid_at } : x)));
    }
  }, [user?.id]);

  // Settlements grouped by customer — clinic OR individual doctor.
  const customers = useMemo(() => {
    const billable = orders.filter((o) => o.status === "delivered");
    const map = new Map<string, { key: string; name: string; kind: "clinic" | "doctor" | "external"; orders: LabOrder[] }>();
    for (const o of billable) {
      const kind: "clinic" | "doctor" | "external" = o.clinic_id ? "clinic" : o.doctor_id ? "doctor" : "external";
      const name = o.clinic_name || o.doctor_name || o.external_customer_name || "Внешний заказчик";
      const key = o.clinic_id || o.doctor_id || o.external_customer_name || "external";
      if (!map.has(key)) map.set(key, { key, name, kind, orders: [] });
      map.get(key)!.orders.push(o);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        count: g.orders.length,
        paid: sumByCurrency(g.orders.filter((o) => o.paid_at)),
        debt: sumByCurrency(g.orders.filter((o) => !o.paid_at)),
      }))
      .sort((a, b) => total(b.debt) - total(a.debt));
  }, [orders]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return customers.filter((c) => {
      const matchQ = !query || c.name.toLowerCase().includes(query);
      const matchKind = kind === "all" || c.kind === kind;
      const hasDebt = total(c.debt) > 0;
      const matchStatus = status === "all" || (status === "debt" ? hasDebt : !hasDebt);
      return matchQ && matchKind && matchStatus;
    });
  }, [customers, q, kind, status]);

  // Totals across ALL delivered orders (unaffected by filters).
  const totals = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    return {
      paid: sumByCurrency(delivered.filter((o) => o.paid_at)),
      debt: sumByCurrency(delivered.filter((o) => !o.paid_at)),
    };
  }, [orders]);

  return (
    <TechnicianLayout title={uz ? "Hisob-kitoblar" : "Расчёты"} subtitle={uz ? "Shifokorlar va klinikalar bo‘yicha to‘lovlar" : "Оплаты и долги по врачам и клиникам"}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
        {error && !loading && (
          <DesignCard className="bg-card border-border" pad="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] text-destructive">{error}</div>
              <Button variant="outline" size="sm" onClick={load}>
                Повторить
              </Button>
            </div>
          </DesignCard>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3">
          <DesignCard pad="p-4" className="bg-card border-border">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground font-medium">Оплачено</span>
              <Wallet className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <div className="mt-2 text-[20px] font-bold tabular-nums text-[hsl(var(--brand-700))] leading-tight">
              {loading ? "—" : fmtMoneyMap(totals.paid)}
            </div>
          </DesignCard>
          <DesignCard pad="p-4" className="bg-card border-border">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground font-medium">Долг</span>
              <HandCoins className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <div className="mt-2 text-[20px] font-bold tabular-nums text-rose-700 leading-tight">
              {loading ? "—" : fmtMoneyMap(totals.debt)}
            </div>
          </DesignCard>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={uz ? "Buyurtmachi bo‘yicha qidirish" : "Поиск по заказчику"}
              className="h-9 pl-9"
            />
          </div>
          <select
            value={kind}
            onChange={(e) => {
              if (isCustomerKindFilter(e.target.value)) setKind(e.target.value);
            }}
            className={SELECT_CLS}
            aria-label="Тип"
          >
            <option value="all">{uz ? "Barcha buyurtmachilar" : "Все заказчики"}</option>
            <option value="doctor">{uz ? "Shifokorlar" : "Врачи"}</option>
            <option value="clinic">{uz ? "Klinikalar" : "Клиники"}</option>
            <option value="external">{uz ? "Tashqi" : "Внешние"}</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              if (isPaymentStatusFilter(e.target.value)) setStatus(e.target.value);
            }}
            className={SELECT_CLS}
            aria-label="Статус"
          >
            <option value="all">Все</option>
            <option value="debt">С долгом</option>
            <option value="paid">Без долга</option>
          </select>
        </div>

        {/* Table */}
        <DesignCard pad="p-0" className="bg-card border-border overflow-x-auto">
          <div className="grid min-w-[620px] grid-cols-[1fr,80px,150px,150px] text-[10px] uppercase tracking-wider text-muted-foreground px-5 py-3 border-b border-border font-mono">
            <div>{uz ? "Buyurtmachi" : "Заказчик"}</div>
            <div className="text-right">{uz ? "Buyurtmalar" : "Заказов"}</div>
            <div className="text-right">{uz ? "To‘langan" : "Оплачено"}</div>
            <div className="text-right">{uz ? "Qarz" : "Долг"}</div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-[13.5px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="w-11 h-11 rounded-[12px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))]">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-[13.5px] text-foreground font-semibold">
                {customers.length === 0 ? "Пока нет данных" : "Ничего не найдено"}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {customers.length === 0 ? "Появятся после выдачи заказов." : "Измените фильтры."}
              </div>
            </div>
          ) : (
            filtered.map((c) => {
              const open = openCust === c.key;
              const hasDebt = total(c.debt) > 0;
              const rows = c.orders
                .slice()
                .sort((a, b) => Number(b.order_number ?? 0) - Number(a.order_number ?? 0));
              return (
                <div key={c.key} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => setOpenCust(open ? null : c.key)}
                    className="grid min-w-[620px] w-full grid-cols-[1fr,80px,150px,150px] text-[13px] px-5 py-3.5 items-center text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="ml-2 text-[10.5px] text-muted-foreground">
                        {c.kind === "clinic" ? "клиника" : c.kind === "doctor" ? "врач" : "внешний"}
                      </span>
                    </div>
                    <div className="text-right tabular-nums text-muted-foreground">{c.count}</div>
                    <div className="text-right tabular-nums font-semibold text-[hsl(var(--brand-700))]">
                      {fmtMoneyMap(c.paid)}
                    </div>
                    <div
                      className={cn(
                        "text-right tabular-nums font-semibold",
                        hasDebt ? "text-rose-700" : "text-muted-foreground",
                      )}
                    >
                      {fmtMoneyMap(c.debt)}
                    </div>
                  </button>
                  {open && (
                    <div className="bg-muted/20 px-5 pb-2">
                      {rows.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between gap-3 border-b border-border/50 py-2 text-[12.5px] last:border-0"
                        >
                          <div className="min-w-0 truncate">
                            <span className="font-mono text-muted-foreground">
                              {o.order_number != null ? `№${o.order_number}` : ""}
                            </span>{" "}
                            <span className="text-foreground">{o.work_type}</span>
                            {o.patient_name && <span className="text-muted-foreground"> · {o.patient_name}</span>}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="tabular-nums font-medium text-foreground">
                              {fmtCur(o.currency, Number(o.price) || 0)}
                            </span>
                            <Button
                              size="sm"
                              variant={o.paid_at ? "outline" : "default"}
                              className="h-7 gap-1 text-[11.5px]"
                              onClick={() => togglePaid(o)}
                            >
                              {o.paid_at ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Оплачено
                                </>
                              ) : (
                                "Отметить оплату"
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </DesignCard>
      </div>
    </TechnicianLayout>
  );
}
