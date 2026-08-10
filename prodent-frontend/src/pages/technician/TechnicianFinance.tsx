import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, BarChart3, Building2, CheckCircle2, Clock, Download, HandCoins, Loader2, TrendingUp, Wallet } from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { DesignCard, SectionTitle } from "@/components/design";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  lab,
  type LabClinicRevenue,
  type LabOrder,
  type LabOrderStatus,
} from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";
import { clearPersistentClientRequestId, getPersistentClientRequestId } from "@/lib/crm-operations-api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Status model ─────────────────────────────────────────────────────────────
// delivered  → realized revenue
// queued|model|wax|milling|frame|glaze|ready → pending revenue (non-terminal)
// cancelled  → excluded entirely
const PENDING_STATUSES = new Set<LabOrderStatus>(["queued", "model", "wax", "milling", "frame", "glaze", "ready"]);

const WORK_LABELS: Record<string, string> = {};

// Money formatter — thousands separators + " сум".
function formatMoney(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "0 сум";
  const rounded = Math.round(n);
  return `${rounded.toLocaleString("ru-RU").replace(/\u00a0/g, " ")} сум`;
}

function priceOf(order: LabOrder): number {
  const n = Number(order.price);
  return Number.isFinite(n) ? n : 0;
}

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

function tsOf(value: string | null | undefined): number {
  if (!value) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

function formatDate(value: string | null | undefined): string {
  const t = tsOf(value);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

// Build the last 6 calendar months (oldest → newest), each with a ru short label.
function lastSixMonths(): { key: string; label: string; year: number; month: number }[] {
  const out: { key: string; label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label,
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return out;
}

export default function TechnicianFinance() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const uz = language === "uz";
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [clinics, setClinics] = useState<LabClinicRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCust, setOpenCust] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ord, clin] = await Promise.all([lab.listOrders(), lab.clinicRevenue()]);
      setOrders(ord);
      setClinics(clin);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Не удалось загрузить данные"));
      setOrders([]);
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const receivable = useMemo(
    () => clinics.reduce((s, c) => s + (Number(c.receivable_revenue) || 0), 0),
    [clinics],
  );
  const materialsCost = useMemo(
    () => clinics.reduce((s, c) => s + (Number(c.materials_cost) || 0), 0),
    [clinics],
  );

  const exportClinicsCsv = () => {
    if (!clinics.length) return;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Клиника", "Заказов", "Оплачено", "Дебиторка", "Не оплачено (шт)", "Материалы"].map(esc).join(",");
    const rows = clinics.map((c) =>
      [c.clinic_name, c.orders, Math.round(Number(c.paid_revenue)), Math.round(Number(c.receivable_revenue)), c.unpaid_count, Math.round(Number(c.materials_cost))]
        .map(esc)
        .join(","),
    );
    const blob = new Blob(["﻿" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lab-finance-clinics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    const revenue = delivered.reduce((s, o) => s + priceOf(o), 0);
    const pending = orders
      .filter((o) => PENDING_STATUSES.has(o.status))
      .reduce((s, o) => s + priceOf(o), 0);
    const cutoff = Date.now() - 30 * 86_400_000;
    const revenue30 = delivered.reduce((s, o) => {
      const t = tsOf(o.updated_at);
      // If updated_at missing, count it (best-effort) toward the recent window.
      if (Number.isNaN(t) || t >= cutoff) return s + priceOf(o);
      return s;
    }, 0);
    return { revenue, pending, revenue30, deliveredCount: delivered.length };
  }, [orders]);

  // ── Monthly revenue (delivered, by updated_at) ──────────────────────────────
  const months = useMemo(() => {
    const buckets = lastSixMonths();
    const sums = new Map<string, number>(buckets.map((b) => [b.key, 0]));
    for (const o of orders) {
      if (o.status !== "delivered") continue;
      const t = tsOf(o.updated_at);
      if (Number.isNaN(t)) continue;
      const d = new Date(t);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (sums.has(key)) sums.set(key, (sums.get(key) || 0) + priceOf(o));
    }
    const rows = buckets.map((b) => ({ ...b, amount: sums.get(b.key) || 0 }));
    const max = rows.reduce((m, r) => Math.max(m, r.amount), 0);
    const hasAny = rows.some((r) => r.amount > 0);
    return { rows, max, hasAny };
  }, [orders]);

  // ── Recent delivered orders ─────────────────────────────────────────────────
  const recent = useMemo(() => {
    return orders
      .filter((o) => o.status === "delivered")
      .sort((a, b) => {
        const at = tsOf(a.updated_at);
        const bt = tsOf(b.updated_at);
        const av = Number.isNaN(at) ? -Infinity : at;
        const bv = Number.isNaN(bt) ? -Infinity : bt;
        return bv - av;
      })
      .slice(0, 12);
  }, [orders]);

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

  // Settlements grouped by CUSTOMER — clinic OR individual doctor ("по врачам").
  const customers = useMemo(() => {
    const billable = orders.filter((o) => o.status === "delivered");
    const map = new Map<string, { key: string; name: string; kind: "clinic" | "doctor"; orders: LabOrder[] }>();
    for (const o of billable) {
      const isClinic = !!o.clinic_id;
      const name = o.clinic_name || o.doctor_name || "Внешний заказчик";
      const key = o.clinic_id || o.doctor_id || name;
      if (!map.has(key)) map.set(key, { key, name, kind: isClinic ? "clinic" : "doctor", orders: [] });
      map.get(key)!.orders.push(o);
    }
    const sum = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0);
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        count: g.orders.length,
        paid: sumByCurrency(g.orders.filter((o) => o.paid_at)),
        debt: sumByCurrency(g.orders.filter((o) => !o.paid_at)),
      }))
      .sort((a, b) => sum(b.debt) - sum(a.debt));
  }, [orders]);

  const kpiCards = [
    {
      l: "Выручка",
      v: formatMoney(kpis.revenue),
      sub: "выдано клиникам",
      icon: Wallet,
      tone: "text-[hsl(var(--brand-700))]",
    },
    {
      l: "Дебиторка",
      v: formatMoney(receivable),
      sub: "не оплачено клиниками",
      icon: HandCoins,
      tone: "text-rose-700",
    },
    {
      l: "Ожидается",
      v: formatMoney(kpis.pending),
      sub: "заказы в работе",
      icon: Clock,
      tone: "text-amber-700",
    },
    {
      l: "Материалы",
      v: formatMoney(materialsCost),
      sub: "себестоимость выданных",
      icon: TrendingUp,
      tone: "text-foreground",
    },
  ];

  return (
    <TechnicianLayout title={uz ? "Moliya" : "Финансы"} subtitle={uz ? "Laboratoriya buyurtmalari bo‘yicha daromad" : "Доход по заказам зуботехнической лаборатории"}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1320px] mx-auto">
        {/* Top-level error */}
        {error && !loading && (
          <DesignCard className="mb-6 bg-card border-border" pad="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-rose-50 grid place-items-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] text-foreground font-medium">Не удалось загрузить данные</div>
                <div className="text-[12px] text-muted-foreground truncate">{error}</div>
              </div>
              <Button variant="outline" size="sm" onClick={load}>
                Повторить
              </Button>
            </div>
          </DesignCard>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {kpiCards.map((s) => {
            const Icon = s.icon;
            return (
              <DesignCard key={s.l} pad="p-4" className="bg-card border-border">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-muted-foreground font-medium">{s.l}</div>
                  <Icon className="w-4 h-4 text-muted-foreground/70" />
                </div>
                <div
                  className={cn(
                    "mt-2 text-[20px] font-bold tabular-nums font-display leading-tight",
                    s.tone,
                  )}
                >
                  {loading ? "—" : s.v}
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-1.5">{s.sub}</div>
              </DesignCard>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Revenue by month */}
          <div className="lg:col-span-2">
            <SectionTitle subtitle={uz ? "oxirgi 6 oyda topshirilgan" : "выдано за последние 6 месяцев"}>{uz ? "Oylar bo‘yicha tushum" : "Выручка по месяцам"}</SectionTitle>
            <DesignCard pad="p-5" className="bg-card border-border">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-[13.5px]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
                </div>
              ) : !months.hasAny ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="w-11 h-11 rounded-[12px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))]">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="text-[13.5px] text-foreground font-semibold">Пока нет данных</div>
                  <div className="text-[12px] text-muted-foreground">Нет выданных заказов за этот период.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {months.rows.map((m) => {
                    const pct = months.max > 0 ? Math.round((m.amount / months.max) * 100) : 0;
                    return (
                      <div key={m.key}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[12px] font-medium text-muted-foreground capitalize w-10 shrink-0">
                            {m.label}
                          </span>
                          <span className="text-[12.5px] font-semibold tabular-nums text-foreground">
                            {formatMoney(m.amount)}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${m.amount > 0 ? Math.max(pct, 3) : 0}%`,
                              background: "hsl(var(--brand))",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DesignCard>
          </div>

          {/* Recent delivered */}
          <div className="lg:col-span-3">
            <SectionTitle subtitle={uz ? "oxirgi topshirilgan buyurtmalar" : "последние выданные заказы"}>{uz ? "Oxirgi topshirilganlar" : "Последние выданные"}</SectionTitle>
            <DesignCard pad="p-0" className="bg-card border-border overflow-x-auto">
              <div className="grid min-w-[680px] grid-cols-[70px,1fr,1fr,130px,110px] text-[10px] uppercase tracking-wider text-muted-foreground px-5 py-3 border-b border-border font-mono">
                <div>№</div>
                <div>{uz ? "Bemor" : "Пациент"}</div>
                <div>{uz ? "Ish" : "Работа"}</div>
                <div className="text-right">{uz ? "Summa" : "Сумма"}</div>
                <div className="text-right">{uz ? "Sana" : "Дата"}</div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-[13.5px]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
                </div>
              ) : recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <div className="w-11 h-11 rounded-[12px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))]">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="text-[13.5px] text-foreground font-semibold">Пока нет данных</div>
                  <div className="text-[12px] text-muted-foreground">Выданных заказов ещё нет.</div>
                </div>
              ) : (
                recent.map((o) => (
                  <div
                    key={o.id}
                    className="grid min-w-[680px] grid-cols-[70px,1fr,1fr,130px,110px] text-[13px] px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-muted/40"
                  >
                    <div className="font-mono text-[12px] text-muted-foreground tabular-nums">
                      {o.order_number != null ? `№${o.order_number}` : String(o.id).slice(0, 6)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {o.patient_name || "Без пациента"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-foreground truncate">
                        {WORK_LABELS[o.work_type] || o.work_type || "—"}
                      </div>
                    </div>
                    <div className="text-right font-semibold tabular-nums text-foreground">
                      {formatMoney(o.price)}
                    </div>
                    <div className="text-right text-[12px] tabular-nums text-muted-foreground">
                      {formatDate(o.updated_at)}
                    </div>
                  </div>
                ))
              )}
            </DesignCard>
          </div>
        </div>

        {/* Full per-customer settlements (with filters) live on their own page. */}
        <div className="mt-6">
          <Link
            to="/technician/settlements"
            className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-5 py-4 transition hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))] shrink-0">
                <HandCoins className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-foreground">Расчёты по врачам и клиникам</div>
                <div className="text-[12px] text-muted-foreground">Оплаты, долги и отметка оплаты — с фильтрами</div>
              </div>
            </div>
            <span className="text-[13px] font-medium text-[hsl(var(--brand-700))] shrink-0">Открыть →</span>
          </Link>
        </div>
      </div>
    </TechnicianLayout>
  );
}
