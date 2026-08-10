import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, CreditCard, Loader2, Package, PackageCheck, Scale, ShoppingBag, Store, X } from "lucide-react";
import { toast } from "sonner";
import { marketplace } from "@/lib/marketplace";
import { MARKET_ROUTES } from "@/lib/market-routes";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  unit: string | null;
  price: number;
  quantity: number;
  line_total: number;
}
interface OrderEvent {
  from_status: string | null;
  to_status: string;
  actor_role?: string | null;
  reason?: string | null;
  created_at: string;
}
interface BuyerOrder {
  id: string;
  order_number: number;
  status: string;
  total_amount: number;
  currency: string;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_address: string | null;
  created_at: string;
  supplier_name: string | null;
  items: OrderItem[];
  events?: OrderEvent[];
  payment_status?: string | null;
  payment_method?: string | null;
}

const fmt = (n: number) => Number(n).toLocaleString("ru-RU");

// Status meta. Buyer can only cancel while new/accepted (BUYER_CANCELABLE_FROM
// in MarketplaceController).
const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Новый", cls: "bg-primary/10 text-primary border-primary/30" },
  accepted: { label: "Принят", cls: "bg-success-green/10 text-success-green border-success-green/30" },
  awaiting_payment: { label: "Ждёт оплату", cls: "bg-warning-amber/10 text-warning-amber border-warning-amber/30" },
  preparing: { label: "Готовится", cls: "bg-primary/10 text-primary border-primary/30" },
  shipped: { label: "Отправлен", cls: "bg-primary/10 text-primary border-primary/30" },
  received: { label: "Получен", cls: "bg-success-green/10 text-success-green border-success-green/30" },
  completed: { label: "Выполнен", cls: "bg-success-green/10 text-success-green border-success-green/30" },
  cancelled: { label: "Отменён", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};
// Buyer may cancel until preparation starts (BUYER_CANCELABLE_FROM in MarketplaceController).
const CANCELABLE = new Set(["new", "accepted", "awaiting_payment"]);

// Happy-path lifecycle for the progress bar.
const STAGES = [
  { key: "new", label: "Создан" },
  { key: "accepted", label: "Принят" },
  { key: "awaiting_payment", label: "Ждёт оплату" },
  { key: "preparing", label: "Готовится" },
  { key: "shipped", label: "Едет к вам" },
  { key: "received", label: "Получен" },
  { key: "completed", label: "Исполнен" },
] as const;

const dt = (s: string) => new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const actorLabel = (role?: string | null) =>
  role === "supplier" ? "поставщиком" : role === "admin" ? "администратором" : role === "buyer" ? "покупателем" : "";

const allStatusKeys = ["new", "accepted", "awaiting_payment", "preparing", "shipped", "received", "completed", "cancelled"];

function statusMeta(s: string) {
  return STATUS[s] ?? { label: s, cls: "bg-muted text-muted-foreground border-border" };
}

// Horizontal lifecycle timeline. Stage timestamps come from order.events (each
// transition is logged with created_at); "Создан" uses the order's own created_at.
function OrderProgress({ order }: { order: BuyerOrder }) {
  const events = order.events || [];
  const cancelled = order.status === "cancelled";
  const tsOf = (key: string) =>
    key === "new" ? order.created_at : events.find((e) => e.to_status === key)?.created_at ?? null;
  const reachedIdx = cancelled
    ? Math.max(0, ...events.filter((e) => e.to_status !== "cancelled").map((e) => STAGES.findIndex((s) => s.key === e.to_status)))
    : STAGES.findIndex((s) => s.key === order.status);
  const cancelEv = events.find((e) => e.to_status === "cancelled");

  type Node = { key: string; label: string; done: boolean; current: boolean; cancelled?: boolean; ts: string | null };
  const nodes: Node[] = cancelled
    ? [
        ...STAGES.slice(0, reachedIdx + 1).map((s) => ({ key: s.key, label: s.label, done: true, current: false, ts: tsOf(s.key) })),
        { key: "cancelled", label: "Отменён", done: true, current: true, cancelled: true, ts: cancelEv?.created_at ?? null },
      ]
    : STAGES.map((s, i) => ({ key: s.key, label: s.label, done: i <= reachedIdx, current: i === reachedIdx, ts: i <= reachedIdx ? tsOf(s.key) : null }));

  return (
    <div className="overflow-x-auto px-4 py-4">
      <div className="flex min-w-[560px] items-start">
        {nodes.map((n, i) => {
          const segColor = (on: boolean, isCancel?: boolean) => (on ? (isCancel ? "bg-destructive/60" : "bg-primary") : "bg-border");
          return (
            <div key={n.key} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <div className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : segColor(n.done, n.cancelled))} />
                <div className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2",
                  n.cancelled ? "border-destructive bg-destructive text-destructive-foreground"
                    : n.done ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                  n.current && !n.cancelled ? "ring-4 ring-primary/20" : "",
                )}>
                  {n.cancelled ? <X className="h-4 w-4" /> : n.done ? <Check className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
                </div>
                <div className={cn("h-0.5 flex-1", i === nodes.length - 1 ? "opacity-0" : segColor(nodes[i + 1].done, nodes[i + 1].cancelled))} />
              </div>
              <div className={cn("mt-1.5 text-xs font-medium leading-tight", n.cancelled ? "text-destructive" : n.done ? "text-foreground" : "text-muted-foreground")}>{n.label}</div>
              <div className="mt-0.5 min-h-7 text-xs leading-tight text-muted-foreground">{n.ts ? dt(n.ts) : ""}</div>
            </div>
          );
        })}
      </div>
      {cancelled && (
        <div className="mt-1.5 text-center text-xs text-destructive">
          Отменён{cancelEv?.actor_role ? ` ${actorLabel(cancelEv.actor_role)}` : ""}
          {cancelEv?.reason ? ` · ${cancelEv.reason}` : ""}
        </div>
      )}
    </div>
  );
}

const ALL = "Все";

export default function MarketOrders() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [filter, setFilter] = useState(ALL);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const cancelInputRef = useRef<HTMLInputElement>(null);
  const disputeInputRef = useRef<HTMLInputElement>(null);
  const paymentRequestIds = useRef<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // order ids with the progress bar shown
  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });

  const { data: orders = [], isLoading, error, refetch } = useQuery<BuyerOrder[]>({
    queryKey: ["market-orders", "buyer"],
    queryFn: () => marketplace.listOrders("buyer") as Promise<BuyerOrder[]>,
    refetchInterval: (query) => {
      const current = (query.state.data || []) as BuyerOrder[];
      return current.some((order) => order.status === "awaiting_payment" || order.payment_status === "pending")
        ? 3_000
        : false;
    },
  });

  useEffect(() => {
    for (const order of orders) {
      if (order.payment_status && ["paid", "failed", "refunded"].includes(order.payment_status)) {
        delete paymentRequestIds.current[order.id];
      }
    }
  }, [orders]);

  useEffect(() => {
    if (confirmingId) cancelInputRef.current?.focus();
  }, [confirmingId]);

  useEffect(() => {
    if (disputeId) disputeInputRef.current?.focus();
  }, [disputeId]);

  const closeCancel = (id: string) => {
    setConfirmingId(null);
    setCancelReason("");
    window.requestAnimationFrame(() => document.getElementById(`cancel-order-${id}`)?.focus());
  };

  const closeDispute = (id: string) => {
    setDisputeId(null);
    setDisputeReason("");
    window.requestAnimationFrame(() => document.getElementById(`dispute-order-${id}`)?.focus());
  };

  const transition = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      marketplace.updateOrderStatus(id, status, reason),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "cancelled" ? "Заказ отменён" : "Получение подтверждено");
      closeCancel(vars.id);
      qc.invalidateQueries({ queryKey: ["market-orders", "buyer"] });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || "Не удалось обновить заказ"),
  });

  const pay = useMutation({
    mutationFn: ({ id }: { id: string }) => {
      const requestId =
        paymentRequestIds.current[id] ||
        (paymentRequestIds.current[id] = crypto.randomUUID());
      return marketplace.startTestPayment(id, requestId);
    },
    onSuccess: () => {
      toast.success("Тестовый платёж создан. Ждём безопасное подтверждение сервера.");
      qc.invalidateQueries({ queryKey: ["market-orders", "buyer"] });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || "Не удалось оплатить"),
  });

  const dispute = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      marketplace.openDispute(id, reason),
    onSuccess: (_data, vars) => {
      toast.success("Спор открыт. Администратор увидит причину и историю.");
      closeDispute(vars.id);
      qc.invalidateQueries({ queryKey: ["market-orders", "buyer"] });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || "Не удалось открыть спор"),
  });

  // Status filter chips (only statuses actually present).
  const filters = useMemo(() => {
    const present = new Set(orders.map((o) => o.status));
    return [ALL, ...allStatusKeys.filter((s) => present.has(s))];
  }, [orders]);

  const visible = filter === ALL ? orders : orders.filter((o) => o.status === filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span>Загружаем заказы…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 px-5 py-6 text-center" role="alert">
        <p className="text-cell font-medium text-destructive">Не удалось загрузить заказы.</p>
        <button type="button" onClick={() => void refetch()} className="mt-3 h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Повторить</button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[16px] border border-dashed border-border bg-card px-6 py-16 text-center">
        <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <div className="text-[15px] font-semibold text-foreground">Заказов пока нет</div>
        <div className="mt-1 text-sm text-muted-foreground">Оформите первый заказ в каталоге.</div>
        <Link to={MARKET_ROUTES.catalog()} className="mt-5 inline-flex h-11 items-center rounded-[10px] bg-primary px-4 text-cell font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">{t("market.myOrdersTitle")}</h1>

      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={f === filter}
            className={cn(
              "h-11 rounded-[10px] px-3 text-meta font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              f === filter ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f === ALL ? ALL : statusMeta(f).label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.length === 0 && (
          <div className="rounded-[14px] border border-dashed border-border bg-card px-5 py-12 text-center" role="status">
            <p className="text-sm font-semibold text-foreground">В этом статусе заказов нет</p>
            <button
              type="button"
              onClick={() => setFilter(ALL)}
              className="mt-4 h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Показать все
            </button>
          </div>
        )}
        {visible.map((o) => {
          const sm = statusMeta(o.status);
          const canCancel = CANCELABLE.has(o.status);
          const canReceive = o.status === "shipped";
          const canPay = o.status === "awaiting_payment";
          const isPaid = o.payment_status === "paid";
          const canDispute = o.status === "received" || o.status === "completed";
          return (
            <article key={o.id} className="overflow-hidden rounded-[14px] border border-border bg-card">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3">
                <span className="text-base font-bold tabular-nums">№ {o.order_number}</span>
                <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold", sm.cls)}>{sm.label}</span>
                {isPaid && (
                  <span className="inline-flex h-6 items-center gap-1 rounded-full bg-success-green/10 px-2.5 text-xs font-semibold text-success-green">
                    <CreditCard className="h-3 w-3" aria-hidden="true" /> Оплачено
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Store className="h-3 w-3" /> {o.supplier_name || "Поставщик"}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" /> {new Date(o.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <div className="ml-auto flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  <span className="text-[15px] font-bold tabular-nums">{fmt(o.total_amount)} {o.currency === "UZS" ? "сум" : o.currency}</span>
                  <button
                    type="button"
                    onClick={() => toggleExpand(o.id)}
                    aria-expanded={expanded.has(o.id)}
                    aria-controls={`order-progress-${o.id}`}
                    className="inline-flex h-11 items-center gap-1 rounded-[8px] px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Ход заказа
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded.has(o.id) && "rotate-180")} />
                  </button>
                </div>
              </div>

              {/* Lifecycle progress bar — hidden by default, toggled per order */}
              {expanded.has(o.id) && (
                <div id={`order-progress-${o.id}`} className="border-b border-border">
                  <OrderProgress order={o} />
                </div>
              )}

              <div className="divide-y divide-border px-4">
                {o.items.map((it) => (
                  <div key={it.id} className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2.5 text-sm sm:grid-cols-[32px_minmax(0,1fr)_auto_100px]">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] bg-muted text-muted-foreground">
                      <Package className="h-4 w-4" />
                    </div>
                    <span className="min-w-0 truncate text-foreground">{it.name}</span>
                    <span className="col-start-2 text-muted-foreground tabular-nums sm:col-auto">{fmt(it.price)} × {it.quantity}</span>
                    <span className="col-start-2 font-semibold tabular-nums text-foreground sm:col-auto sm:w-[100px] sm:text-right">{fmt(it.line_total)}</span>
                  </div>
                ))}
              </div>

              {(o.delivery_address || canCancel || canReceive || canPay || canDispute) && (
                <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5">
                  {o.delivery_address && <span className="text-xs text-muted-foreground">Доставка: {o.delivery_address}</span>}
                  <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    {canPay && (
                      <button
                        type="button"
                        onClick={() => pay.mutate({ id: o.id })}
                        disabled={pay.isPending}
                        aria-busy={pay.isPending && pay.variables?.id === o.id}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 text-meta font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:flex-none"
                      >
                        {pay.isPending && pay.variables?.id === o.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <CreditCard className="h-3.5 w-3.5" />}
                        Тестовая оплата
                      </button>
                    )}
                    {canReceive && (
                      <button
                        type="button"
                        onClick={() => transition.mutate({ id: o.id, status: "received" })}
                        disabled={transition.isPending}
                        aria-busy={transition.isPending && transition.variables?.id === o.id}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 text-meta font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:flex-none"
                      >
                        {transition.isPending && transition.variables?.id === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
                        Подтвердить получение
                      </button>
                    )}
                    {canCancel && (confirmingId === o.id ? (
                      <div
                        role="dialog"
                        aria-label={`Отмена заказа № ${o.order_number}`}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") closeCancel(o.id);
                        }}
                        className="flex w-full flex-wrap items-center gap-2 rounded-[10px] border border-destructive/30 bg-destructive/10 p-3 text-meta"
                      >
                        <span className="w-full font-medium text-destructive sm:w-auto">Отменить заказ?</span>
                        <input
                          ref={cancelInputRef}
                          aria-label="Причина отмены"
                          required
                          aria-invalid={!cancelReason.trim()}
                          aria-describedby={`cancel-reason-help-${o.id}`}
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Причина отмены"
                          className="h-11 min-w-0 flex-1 rounded-[8px] border border-border bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48"
                        />
                        <span id={`cancel-reason-help-${o.id}`} className="sr-only">
                          Укажите причину отмены заказа
                        </span>
                        <button
                          type="button"
                          onClick={() => transition.mutate({ id: o.id, status: "cancelled", reason: cancelReason.trim() })}
                          disabled={transition.isPending || !cancelReason.trim()}
                          aria-busy={transition.isPending && transition.variables?.id === o.id}
                          className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-[8px] bg-destructive px-3 text-meta font-semibold text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:flex-none"
                        >
                          {transition.isPending && transition.variables?.id === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          Подтвердить
                        </button>
                        <button type="button" onClick={() => closeCancel(o.id)} className="inline-flex h-11 flex-1 items-center justify-center rounded-[8px] border border-border bg-card px-3 text-meta font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none">
                          Нет
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id={`cancel-order-${o.id}`}
                        onClick={() => {
                          setDisputeId(null);
                          setDisputeReason("");
                          setConfirmingId(o.id);
                          setCancelReason("");
                        }}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-border px-3 text-meta font-medium text-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
                      >
                        <X className="h-3.5 w-3.5" /> Отменить
                      </button>
                    ))}
                    {canDispute && (disputeId === o.id ? (
                      <div
                        role="dialog"
                        aria-label={`Спор по заказу № ${o.order_number}`}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") closeDispute(o.id);
                        }}
                        className="flex w-full flex-wrap items-center gap-2 rounded-[10px] border border-warning-amber/30 bg-warning-amber/10 p-3 text-meta"
                      >
                        <input
                          ref={disputeInputRef}
                          aria-label="Причина спора"
                          required
                          aria-invalid={!disputeReason.trim()}
                          aria-describedby={`dispute-reason-help-${o.id}`}
                          value={disputeReason}
                          onChange={(event) => setDisputeReason(event.target.value)}
                          placeholder="Что произошло?"
                          className="h-11 min-w-0 flex-1 rounded-[8px] border border-border bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
                        />
                        <span id={`dispute-reason-help-${o.id}`} className="sr-only">
                          Опишите причину спора
                        </span>
                        <button
                          type="button"
                          disabled={dispute.isPending || !disputeReason.trim()}
                          onClick={() => dispute.mutate({ id: o.id, reason: disputeReason.trim() })}
                          aria-busy={dispute.isPending}
                          className="h-11 flex-1 rounded-[8px] bg-warning-amber px-3 font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:flex-none"
                        >
                          Открыть спор
                        </button>
                        <button
                          type="button"
                          onClick={() => closeDispute(o.id)}
                          className="h-11 flex-1 rounded-[8px] border border-border bg-card px-3 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id={`dispute-order-${o.id}`}
                        onClick={() => {
                          setConfirmingId(null);
                          setCancelReason("");
                          setDisputeId(o.id);
                        }}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-warning-amber/30 px-3 text-meta font-medium text-warning-amber hover:bg-warning-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
                      >
                        <Scale className="h-3.5 w-3.5" /> Открыть спор
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
