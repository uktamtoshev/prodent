import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown, Clock, Loader2, Phone, Printer, Search, ShoppingBag, Store, Truck, User, X,
} from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { marketplace } from "@/lib/marketplace";

interface OrderEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_role: string | null;
  reason: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  name: string;
  unit: string | null;
  price: number;
  quantity: number;
  line_total: number;
}

interface Order {
  id: string;
  order_number: number;
  buyer_user_id: string;
  supplier_id: string;
  supplier_name?: string | null;
  status: "new" | "accepted" | "awaiting_payment" | "preparing" | "shipped" | "received" | "completed" | "cancelled";
  total_amount: number;
  currency: string;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_address: string | null;
  note: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  created_at: string;
  items?: OrderItem[];
  events?: OrderEvent[];
}

type Status = Order["status"];
type Supplier = { name?: string; phone?: string; address?: string; inn?: string } | null;

const STATUS: Record<Status, { label: string; cls: string }> = {
  new: { label: "Новый", cls: "bg-primary/10 text-primary ring-primary/30" },
  accepted: { label: "Принят", cls: "bg-primary/10 text-primary ring-primary/30" },
  awaiting_payment: { label: "Ждёт оплату", cls: "bg-[hsl(var(--warning-amber)/0.12)] text-[hsl(var(--warning-amber))] ring-[hsl(var(--warning-amber)/0.3)]" },
  preparing: { label: "Готовится", cls: "bg-accent text-accent-foreground ring-border" },
  shipped: { label: "Отправлен", cls: "bg-accent text-accent-foreground ring-border" },
  received: { label: "Получен", cls: "bg-[hsl(var(--success-green)/0.12)] text-[hsl(var(--success-green))] ring-[hsl(var(--success-green)/0.3)]" },
  completed: { label: "Завершён", cls: "bg-[hsl(var(--success-green)/0.12)] text-[hsl(var(--success-green))] ring-[hsl(var(--success-green)/0.3)]" },
  cancelled: { label: "Отменён", cls: "bg-destructive/10 text-destructive ring-destructive/30" },
};

const ROLE_LABEL: Record<string, string> = { supplier: "Поставщик", buyer: "Покупатель", admin: "Администратор" };

// Forward transitions a supplier may apply (UI hinting only — the server is authoritative).
const NEXT: Partial<Record<Status, { to: Status; label: string }[]>> = {
  new: [
    { to: "accepted", label: "Принять" },
    { to: "cancelled", label: "Отклонить" },
  ],
  accepted: [
    { to: "awaiting_payment", label: "Запросить оплату" },
    { to: "cancelled", label: "Отменить" },
  ],
  awaiting_payment: [
    { to: "preparing", label: "В подготовку" },
    { to: "cancelled", label: "Отменить" },
  ],
  preparing: [
    { to: "shipped", label: "Отгрузить" },
    { to: "cancelled", label: "Отменить" },
  ],
  shipped: [{ to: "received", label: "Отметить доставленным" }],
  received: [{ to: "completed", label: "Завершить" }],
};

const REJECT_REASONS = ["Нет в наличии", "Неверный адрес", "Дубликат заказа", "Другое"];

const FILTERS: { id: "all" | Status; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "accepted", label: "Принятые" },
  { id: "awaiting_payment", label: "Ждут оплату" },
  { id: "preparing", label: "Готовятся" },
  { id: "shipped", label: "Отправленные" },
  { id: "received", label: "Получены" },
  { id: "completed", label: "Завершённые" },
  { id: "cancelled", label: "Отменённые" },
];

const PERIODS: { id: "all" | "today" | "7" | "30"; label: string }[] = [
  { id: "all", label: "Всё время" },
  { id: "today", label: "Сегодня" },
  { id: "7", label: "7 дней" },
  { id: "30", label: "30 дней" },
];

const SORTS: { id: "date" | "amount_desc" | "amount_asc"; label: string }[] = [
  { id: "date", label: "Новые сначала" },
  { id: "amount_desc", label: "Сумма ↓" },
  { id: "amount_asc", label: "Сумма ↑" },
];

const fmt = (n: number | string) => Number(n).toLocaleString("ru-RU");
const fmtSum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн` : fmt(n);
const cur = (c: string) => (c === "UZS" ? "сум" : c);
const dt = (s: string) =>
  new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const periodCutoff = (id: (typeof PERIODS)[number]["id"]): number => {
  if (id === "all") return 0;
  if (id === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return Date.now() - (id === "7" ? 7 : 30) * 86_400_000;
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-[14px] border bg-card px-4 py-3 text-card-foreground", accent ? "border-primary/30 bg-primary/5" : "border-border")}>
      <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-[22px] font-bold font-display tabular-nums leading-none", accent && "text-primary")}>{value}</div>
    </div>
  );
}

export default function SellerOrders() {
  const { user } = useAuth();
  const [hasSupplier, setHasSupplier] = useState<boolean | null>(null);
  const [supplier, setSupplier] = useState<Supplier>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("date");
  const [query, setQuery] = useState("");
  const [rejectFor, setRejectFor] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const rejectDialogRef = useDialogFocus(!!rejectFor, () => setRejectFor(null));

  const refresh = async () => {
    if (!user?.id) {
      setOrders([]);
      setSupplier(null);
      setHasSupplier(null);
      setLoadError("Не удалось определить пользователя.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const sup = (await marketplace.getMySupplier()) as Supplier;
      setHasSupplier(!!sup);
      setSupplier(sup);
      if (!sup) {
        setOrders([]);
        return;
      }
      const data = ((await marketplace.listOrders("supplier")) as Order[]) || [];
      setOrders(data);
    } catch {
      toast.error("Ошибка загрузки заказов");
      setOrders([]);
      setLoadError("Не удалось загрузить заказы. Проверьте соединение и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toggle = (order: Order) => setExpanded((cur) => (cur === order.id ? null : order.id));

  const setStatus = async (order: Order, to: Status, reason?: string) => {
    if (busyId || loading || loadError || !supplier) return;
    setBusyId(order.id);
    try {
      const updated = (await marketplace.updateOrderStatus(order.id, to, reason)) as Order;
      toast.success(`Статус: ${STATUS[to].label}`);
      // Merge the authoritative server row (carries fresh events / cancel_reason).
      setOrders((arr) => arr.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить статус");
      // On a conflict/error, re-sync the true state from the server.
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (order: Order) => {
    setRejectReason("");
    setRejectFor(order);
  };
  const confirmReject = () => {
    const o = rejectFor;
    const reason = rejectReason.trim();
    if (!o || !reason) return;
    setRejectFor(null);
    setStatus(o, "cancelled", reason);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach((o) => (c[o.status] = (c[o.status] || 0) + 1));
    return c;
  }, [orders]);

  const kpis = useMemo(() => {
    const win = Date.now() - 30 * 86_400_000;
    let newCount = 0, working = 0, done30 = 0, revenue30 = 0;
    orders.forEach((o) => {
      if (o.status === "new") newCount++;
      if (o.status === "accepted" || o.status === "shipped") working++;
      if (o.status === "completed" && new Date(o.created_at).getTime() >= win) {
        done30++;
        revenue30 += Number(o.total_amount) || 0;
      }
    });
    return { newCount, working, done30, revenue30 };
  }, [orders]);

  const filtered = useMemo(() => {
    let r = orders;
    if (filter !== "all") r = r.filter((o) => o.status === filter);
    const cut = periodCutoff(period);
    if (cut) r = r.filter((o) => new Date(o.created_at).getTime() >= cut);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (o) =>
          String(o.order_number).includes(q) ||
          (o.contact_name || "").toLowerCase().includes(q) ||
          (o.contact_phone || "").toLowerCase().includes(q) ||
          (o.items || []).some((it) => it.name.toLowerCase().includes(q))
      );
    }
    return [...r].sort((a, b) =>
      sort === "amount_desc"
        ? Number(b.total_amount) - Number(a.total_amount)
        : sort === "amount_asc"
        ? Number(a.total_amount) - Number(b.total_amount)
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [orders, filter, period, query, sort]);

  const printSlip = (o: Order) => {
    const rows = (o.items || [])
      .map(
        (it) =>
          `<tr><td>${esc(it.name)}</td><td class="c">${fmt(it.quantity)}${it.unit ? ` ${esc(it.unit)}` : ""}</td>` +
          `<td class="r">${fmt(it.price)}</td><td class="r">${fmt(it.line_total)}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Заказ #${esc(o.order_number)}</title>
<style>
*{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a}
body{margin:32px;font-size:13px}
h1{font-size:20px;margin:0 0 2px}
.muted{color:#64748b;font-size:12px}
.row{display:flex;justify-content:space-between;gap:24px;margin-top:16px}
.box{flex:1}.box b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:left}
th{font-size:11px;text-transform:uppercase;color:#94a3b8}
.c{text-align:center}.r{text-align:right}
.total{margin-top:14px;text-align:right;font-size:16px;font-weight:700}
.stamp{display:inline-block;margin-top:6px;padding:3px 10px;border:1px solid #cbd5e1;border-radius:999px;font-size:12px}
@media print{body{margin:0}}
</style></head><body>
<h1>Накладная — заказ #${esc(o.order_number)}</h1>
<div class="muted">${esc(dt(o.created_at))} · <span class="stamp">${esc(STATUS[o.status].label)}</span></div>
<div class="row">
  <div class="box"><b>Поставщик</b>${esc(o.supplier_name || supplier?.name || "—")}${supplier?.phone ? `<br>${esc(supplier.phone)}` : ""}${supplier?.inn ? `<br>ИНН ${esc(supplier.inn)}` : ""}</div>
  <div class="box"><b>Покупатель</b>${esc(o.contact_name || "—")}${o.contact_phone ? `<br>${esc(o.contact_phone)}` : ""}${o.delivery_address ? `<br>${esc(o.delivery_address)}` : ""}</div>
</div>
${o.note ? `<div class="muted" style="margin-top:12px"><b>Комментарий:</b> ${esc(o.note)}</div>` : ""}
<table><thead><tr><th>Позиция</th><th class="c">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="total">Итого: ${fmt(o.total_amount)} ${esc(cur(o.currency))}</div>
</body></html>`;
    const w = window.open("", "_blank", "width=820,height=920");
    if (!w) {
      toast.error("Разрешите всплывающие окна для печати");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const timeline = (o: Order) => {
    const steps: { label: string; at: string | null; role: string | null; reason: string | null }[] = [
      { label: "Создан", at: o.created_at, role: null, reason: null },
    ];
    const evs = o.events || [];
    evs.forEach((e) =>
      steps.push({ label: STATUS[e.to_status as Status]?.label || e.to_status, at: e.created_at, role: e.actor_role, reason: e.reason })
    );
    // Legacy/pre-V44 orders carry no event rows — reflect the current status so
    // the timeline doesn't contradict the status badge (timestamp unknown).
    if (evs.length === 0 && o.status !== "new") {
      steps.push({ label: STATUS[o.status].label, at: null, role: null, reason: o.cancel_reason });
    }
    return steps;
  };

  return (
    <SellerLayout title="Заказы" subtitle={`${kpis.newCount} новых · ${orders.length} всего`}>
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Загрузка заказов</span>
          </div>
        ) : loadError ? (
          <Card className="border-destructive/30 bg-destructive/10 px-5 py-10 text-center" role="alert">
            <p className="text-[14px] font-medium text-foreground">{loadError}</p>
            <button type="button" onClick={refresh} className="mt-4 h-11 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Повторить
            </button>
          </Card>
        ) : hasSupplier === false ? (
          <Card className="py-16 text-center">
            <div className="w-12 h-12 rounded-[12px] mx-auto bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))] mb-4">
              <Store className="w-6 h-6" />
            </div>
            <h2 className="text-[18px] font-bold font-display">Витрина не создана</h2>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] text-muted-foreground">Заказы появятся после публикации товаров.</p>
            <Link to="/seller/profile" className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Перейти к витрине
            </Link>
          </Card>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <Stat label="Новые" value={String(kpis.newCount)} accent />
              <Stat label="В работе" value={String(kpis.working)} />
              <Stat label="Выполнено · 30 дн" value={String(kpis.done30)} />
              <Stat label="Оборот · 30 дн" value={`${fmtSum(kpis.revenue30)} сум`} />
            </div>

            {/* Toolbar: search + sort + period */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск: № заказа, покупатель, телефон, товар…"
                  aria-label="Поиск заказов"
                  className="h-11 w-full rounded-[10px] border border-border bg-background pl-9 pr-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                aria-label="Сортировка заказов"
                className="h-11 rounded-[10px] border border-border bg-background px-3 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {PERIODS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    "min-h-11 rounded-[10px] px-3 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    period === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                  aria-pressed={period === p.id}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Status filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "min-h-11 rounded-[10px] px-3 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    filter === f.id ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:bg-muted"
                  )}
                  aria-pressed={filter === f.id}
                >
                  {f.label}
                  {counts[f.id] ? <span className="ml-1.5 tabular-nums text-muted-foreground">{counts[f.id]}</span> : null}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <Card className="py-16 text-center" role="status">
                <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <div className="text-[14px] font-medium text-foreground">{query || filter !== "all" || period !== "all" ? "Ничего не найдено" : "Заказов пока нет"}</div>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((o) => {
                  const st = STATUS[o.status];
                  const next = NEXT[o.status] || [];
                  const open = expanded === o.id;
                  const busy = busyId === o.id;
                  return (
                    <div key={o.id} className="overflow-hidden rounded-[14px] border border-border bg-card text-card-foreground">
                      <button type="button" onClick={() => toggle(o)} aria-expanded={open} aria-controls={`order-details-${o.id}`} className="flex min-h-11 w-full items-center gap-3 px-4 py-4 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4 sm:px-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold font-display">Заказ #{o.order_number}</span>
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset", st.cls)}>{st.label}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {o.contact_name || "—"}</span>
                            {o.contact_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {o.contact_phone}</span>}
                            <span>{dt(o.created_at)}</span>
                            <span className="text-muted-foreground">{(o.items || []).length} поз.</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[15px] font-bold tabular-nums">
                            {fmt(o.total_amount)} <span className="text-[12px] font-normal text-muted-foreground">{cur(o.currency)}</span>
                          </div>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", open && "rotate-180")} aria-hidden="true" />
                      </button>

                      {open && (
                        <div id={`order-details-${o.id}`} className="border-t border-border bg-muted/40 px-4 py-4 sm:px-5">
                          {/* line items */}
                          <div className="space-y-1.5">
                            {(o.items || []).map((it) => (
                              <div key={it.id} className="flex items-center justify-between text-[13px]">
                                <span className="text-foreground">
                                  {it.name} <span className="text-muted-foreground">× {it.quantity}{it.unit ? ` ${it.unit}` : ""}</span>
                                </span>
                                <span className="tabular-nums text-muted-foreground">{fmt(it.line_total)} сум</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between border-t border-border pt-1.5 text-[13px] font-semibold">
                              <span>Итого</span>
                              <span className="tabular-nums">{fmt(o.total_amount)} {cur(o.currency)}</span>
                            </div>
                          </div>

                          {o.delivery_address && <div className="mt-3 text-[12.5px] text-muted-foreground"><b>Доставка:</b> {o.delivery_address}</div>}
                          {o.note && <div className="mt-1 text-[12.5px] text-muted-foreground"><b>Комментарий:</b> {o.note}</div>}
                          {o.status === "cancelled" && o.cancel_reason && (
                            <div className="mt-1 text-[12.5px] text-destructive">
                              <b>Причина отмены{o.cancelled_by === "buyer" ? " (покупатель)" : o.cancelled_by === "supplier" ? " (поставщик)" : ""}:</b> {o.cancel_reason}
                            </div>
                          )}

                          {/* status timeline */}
                          <div className="mt-4 rounded-[10px] border border-border bg-card px-3 py-2.5">
                            <div className="mb-2 inline-flex items-center gap-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground"><Clock className="h-3 w-3" /> История</div>
                            <ol className="space-y-1.5">
                              {timeline(o).map((s, i, arr) => (
                                <li key={i} className="flex items-start gap-2 text-[12px]">
                                  <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", i === arr.length - 1 ? "bg-primary" : "bg-muted-foreground")} />
                                  <span className="font-medium text-foreground">{s.label}</span>
                                  {s.role && <span className="text-muted-foreground">· {ROLE_LABEL[s.role] || s.role}</span>}
                                  {s.at && <span className="ml-auto tabular-nums text-muted-foreground">{dt(s.at)}</span>}
                                </li>
                              ))}
                            </ol>
                          </div>

                          {/* actions */}
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            {next.map((n) => (
                              <button
                                key={n.to}
                                disabled={!!busyId}
                                onClick={() => (n.to === "cancelled" ? openReject(o) : setStatus(o, n.to))}
                                className={cn(
                                  "inline-flex h-11 items-center gap-1.5 rounded-[10px] px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                                  n.to === "cancelled"
                                    ? "border border-destructive/30 bg-card text-destructive hover:bg-destructive/10"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                                )}
                              >
                                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {n.to === "shipped" && !busy && <Truck className="h-3.5 w-3.5" />}
                                {n.label}
                              </button>
                            ))}
                            <button
                              onClick={() => printSlip(o)}
                              className="inline-flex h-11 items-center gap-1.5 rounded-[10px] border border-border bg-card px-4 text-[13px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Printer className="h-3.5 w-3.5" /> Печать
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Reject / cancel reason dialog */}
      {rejectFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onMouseDown={() => setRejectFor(null)}>
          <div ref={rejectDialogRef} role="dialog" aria-modal="true" aria-labelledby="reject-order-title" aria-describedby="reject-order-description" tabIndex={-1} className="w-full max-w-md rounded-[16px] bg-card p-5 text-card-foreground shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 id="reject-order-title" className="text-[16px] font-bold font-display">Отмена заказа #{rejectFor.order_number}</h3>
              <button type="button" aria-label="Закрыть" onClick={() => setRejectFor(null)} className="grid h-11 w-11 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <p id="reject-order-description" className="mt-1 text-[12.5px] text-muted-foreground">Покупатель увидит причину. Если заказ был принят, остаток вернётся на склад.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRejectReason(r === "Другое" ? "" : r)}
                  className={cn(
                    "min-h-11 rounded-[10px] px-3 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    rejectReason === r ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30" : "text-muted-foreground hover:bg-muted"
                  )}
                  aria-pressed={rejectReason === r}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              aria-invalid={!rejectReason.trim()}
              aria-describedby="reject-order-description"
              placeholder="Причина отмены…"
              aria-label="Причина отмены"
              className="mt-3 w-full rounded-[10px] border border-border bg-background p-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setRejectFor(null)} className="h-11 rounded-[10px] border border-border bg-card px-4 text-[13px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Назад</button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className="h-11 rounded-[10px] bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Отменить заказ
              </button>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}
