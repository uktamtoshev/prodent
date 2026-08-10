import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
  User,
} from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { DesignBadge } from "@/components/design";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  lab,
  type LabMessage,
  type LabOrder,
  type LabOrderStatus,
} from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";
import { cn } from "@/lib/utils";
import { clearLabDraft, loadLabDraft, saveLabDraft } from "@/lib/lab-drafts";
import { getLabStatusLabel } from "@/lib/lab-workflow";

// ── Order status model (mirrors TechnicianOrders) ───────────────────────────
const STATUS_TONE: Record<
  string,
  "neutral" | "teal" | "amber" | "rose" | "emerald" | "sky" | "violet"
> = {
  new: "sky",
  queued: "neutral",
  model: "violet",
  wax: "amber",
  milling: "teal",
  frame: "sky",
  glaze: "violet",
  ready: "emerald",
  delivered: "emerald",
  cancelled: "rose",
  declined: "rose",
};

// Terminal statuses sink to the bottom of the order list.
const TERMINAL = new Set<LabOrderStatus>(["delivered", "cancelled", "declined"]);

type DisplayMessage = LabMessage & { __optimistic?: boolean };

const ROLE_LABELS: Record<string, string> = {
  technician: "Техник",
  clinic: "Клиника",
  clinic_admin: "Клиника",
  doctor: "Врач",
  manager: "Менеджер",
  admin: "Администратор",
  super_admin: "Администратор",
};

function roleLabel(role: string | null | undefined): string {
  if (!role) return "Участник";
  return ROLE_LABELS[role] ?? role;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderTitle(order: LabOrder): string {
  if (order.order_number != null) return `№${order.order_number}`;
  return `#${order.id.slice(0, 6)}`;
}

export default function TechnicianMessages() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const tx = useCallback((ru: string, uz: string) => (language === "uz" ? uz : ru), [language]);

  // ── Orders (left pane) ──────────────────────────────────────────────────
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Thread (right pane) ─────────────────────────────────────────────────
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const threadRequestRef = useRef(0);
  const selectedIdRef = useRef<string | null>(null);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const all = await lab.listOrders();
      // Non-terminal first, then by order_number desc within each group.
      const sorted = [...all].sort((a, b) => {
        const at = TERMINAL.has(a.status) ? 1 : 0;
        const bt = TERMINAL.has(b.status) ? 1 : 0;
        if (at !== bt) return at - bt;
        const an = Number(a.order_number ?? 0);
        const bn = Number(b.order_number ?? 0);
        return bn - an;
      });
      setOrders(sorted);
    } catch (error: unknown) {
      setOrdersError(getErrorMessage(error, tx("Не удалось загрузить заказы", "Buyurtmalar yuklanmadi")));
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [tx]);

  const loadThread = useCallback(async (
    orderId: string,
    options: { preserveOnError?: boolean } = {},
  ): Promise<boolean> => {
    const requestId = ++threadRequestRef.current;
    if (!options.preserveOnError) {
      setThreadLoading(true);
      setThreadError(null);
    }
    try {
      const nextMessages = await lab.listMessages(orderId);
      if (
        requestId !== threadRequestRef.current ||
        selectedIdRef.current !== orderId
      ) return false;
      setMessages(nextMessages);
      setRefreshWarning(null);
      return true;
    } catch (error: unknown) {
      if (
        requestId !== threadRequestRef.current ||
        selectedIdRef.current !== orderId
      ) return false;
      const message = getErrorMessage(
        error,
        tx("Не удалось загрузить переписку", "Yozishma yuklanmadi"),
      );
      if (options.preserveOnError) {
        setRefreshWarning(
          tx(
            "Сообщение отправлено, но переписка не обновилась. Повторите обновление.",
            "Xabar yuborildi, ammo yozishma yangilanmadi. Qayta yangilang.",
          ),
        );
      } else {
        setThreadError(message);
        setMessages([]);
      }
      return false;
    } finally {
      if (
        requestId === threadRequestRef.current &&
        selectedIdRef.current === orderId &&
        !options.preserveOnError
      ) setThreadLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
    else setMessages([]);
  }, [selectedId, loadThread]);

  const selectOrder = useCallback((orderId: string | null) => {
    threadRequestRef.current += 1;
    selectedIdRef.current = orderId;
    setRefreshWarning(null);
    setMessages([]);
    setSelectedId(orderId);
  }, []);

  useEffect(() => {
    if (!selectedId || !user?.id) return;
    setBody(loadLabDraft(`message:${selectedId}`, user.id, ""));
  }, [selectedId, user?.id]);

  useEffect(() => {
    if (!selectedId || !user?.id) return;
    saveLabDraft(`message:${selectedId}`, user.id, body);
  }, [body, selectedId, user?.id]);

  // Keep the latest message in view.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const selectedOrder = useMemo(
    () => orders.find((o) => String(o.id) === String(selectedId)) ?? null,
    [orders, selectedId],
  );

  const handleSend = async () => {
    const text = body.trim();
    if (!text || !selectedId || sending) return;
    setSendError(null);
    setSending(true);

    // Optimistic append — replaced by the authoritative refetch below.
    const optimistic: DisplayMessage = {
      id: `tmp-${Date.now()}`,
      order_id: selectedId,
      sender_user_id: user?.id ?? null,
      sender_role: "technician",
      body: text,
      created_at: new Date().toISOString(),
      __optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");

    try {
      // The server stamps sender_user_id + sender_role from the JWT.
      await lab.sendMessage(selectedId, text, { online: navigator.onLine });
    } catch (error: unknown) {
      // Roll back the optimistic bubble and restore the draft.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(text);
      const message = getErrorMessage(error, tx("Попробуйте ещё раз.", "Qayta urinib ko‘ring."));
      setSendError(message);
      toast({
        title: tx("Сообщение не отправлено", "Xabar yuborilmadi"),
        description: message,
        variant: "destructive",
      });
      setSending(false);
      return;
    }

    clearLabDraft(`message:${selectedId}`, user?.id);
    setMessages((prev) =>
      prev.map((message) =>
        message.id === optimistic.id
          ? { ...message, __optimistic: false }
          : message,
      ),
    );

    if (selectedIdRef.current !== selectedId) {
      setSending(false);
      return;
    }

    try {
      await loadThread(selectedId, { preserveOnError: true });
    } finally {
      setSending(false);
    }
  };

  const onComposeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeCount = useMemo(
    () => orders.filter((o) => !TERMINAL.has(o.status)).length,
    [orders],
  );

  return (
    <TechnicianLayout
      title={tx("Сообщения", "Xabarlar")}
      subtitle={`${tx("Переписка с клиниками по заказам", "Klinikalar bilan buyurtmalar bo‘yicha yozishma")} · ${activeCount} ${tx("активных", "faol")}`}
    >
      <div className="mx-auto min-w-0 max-w-[1320px] p-2 sm:p-4 lg:p-6">
        <div className="grid h-[calc(100dvh-9rem)] min-h-[420px] min-w-0 grid-cols-1 gap-4 lg:h-[calc(100dvh-10rem)] lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* ── LEFT: orders list ─────────────────────────────────────── */}
          <div className={cn("flex flex-col rounded-[14px] border border-border bg-card overflow-hidden", selectedId && "hidden lg:flex")}>
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="text-[13px] font-semibold text-foreground">{tx("Заказы", "Buyurtmalar")}</div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">
                {tx("Выберите заказ для переписки", "Yozishma uchun buyurtmani tanlang")}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {ordersLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-[13px]" role="status" aria-live="polite">
                  <Loader2 className="w-4 h-4 animate-spin" /> {tx("Загрузка заказов…", "Buyurtmalar yuklanmoqda…")}
                </div>
              ) : ordersError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert">
                  <div className="w-11 h-11 rounded-[12px] bg-rose-50 grid place-items-center text-rose-600">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="text-[13px] text-foreground font-medium">
                    {tx("Не удалось загрузить заказы", "Buyurtmalar yuklanmadi")}
                  </div>
                  <div className="text-[12px] text-muted-foreground">{ordersError}</div>
                  <Button variant="outline" size="sm" onClick={loadOrders} className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring">
                    {tx("Повторить", "Qayta urinish")}
                  </Button>
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
                  <div className="w-11 h-11 rounded-[12px] bg-muted grid place-items-center text-muted-foreground">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div className="text-[13.5px] text-foreground font-semibold">{tx("Заказов нет", "Buyurtmalar yo‘q")}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {tx("Здесь появятся заказы для переписки.", "Yozishma buyurtmalari shu yerda ko‘rinadi.")}
                  </div>
                </div>
              ) : (
                orders.map((o) => {
                  const selected = String(o.id) === String(selectedId);
                  return (
                    <button
                      type="button"
                      key={o.id}
                      onClick={() => selectOrder(String(o.id))}
                      className={cn(
                        "min-h-11 w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        selected
                          ? "bg-[hsl(var(--brand-50))]"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                          {orderTitle(o)}
                        </span>
                        <DesignBadge tone={STATUS_TONE[o.status] ?? "neutral"}>
                          {getLabStatusLabel(o.status, language)}
                        </DesignBadge>
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-[13px] font-medium truncate",
                          selected
                            ? "text-[hsl(var(--brand-700))]"
                            : "text-foreground",
                        )}
                      >
                          {o.patient_name || tx("Без пациента", "Bemor ko‘rsatilmagan")}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                        {o.work_type || tx("Тип работы не указан", "Ish turi ko‘rsatilmagan")}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT: thread ─────────────────────────────────────────── */}
          <div className={cn("flex-col rounded-[14px] border border-border bg-card overflow-hidden min-h-0", selectedId ? "flex" : "hidden lg:flex")}>
            {!selectedOrder ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="w-14 h-14 rounded-[14px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))]">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="text-[15px] font-semibold text-foreground">
                  {tx("Выберите заказ", "Buyurtmani tanlang")}
                </div>
                <div className="text-[13px] text-muted-foreground max-w-xs">
                  {tx("Откройте заказ слева, чтобы посмотреть переписку с клиникой и ответить.", "Klinika bilan yozishmani ko‘rish va javob berish uchun buyurtmani oching.")}
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between gap-3">
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 focus-visible:ring-2 focus-visible:ring-ring lg:hidden" onClick={() => selectOrder(null)} aria-label={tx("К списку заказов", "Buyurtmalar ro‘yxatiga")}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                        {orderTitle(selectedOrder)}
                      </span>
                      <DesignBadge tone={STATUS_TONE[selectedOrder.status] ?? "neutral"}>
                        {getLabStatusLabel(selectedOrder.status, language)}
                      </DesignBadge>
                    </div>
                    <div className="text-[14px] font-semibold text-foreground truncate mt-0.5">
                      {selectedOrder.patient_name || tx("Без пациента", "Bemor ko‘rsatilmagan")}
                      <span className="text-[12.5px] text-muted-foreground font-normal">
                        {selectedOrder.work_type ? ` · ${selectedOrder.work_type}` : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-3">
                  {threadLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-[13px]" role="status" aria-live="polite">
                      <Loader2 className="w-4 h-4 animate-spin" /> {tx("Загрузка переписки…", "Yozishma yuklanmoqda…")}
                    </div>
                  ) : threadError ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
                      <div className="w-11 h-11 rounded-[12px] bg-rose-50 grid place-items-center text-rose-600">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="text-[13px] text-foreground font-medium">
                        {tx("Не удалось загрузить переписку", "Yozishma yuklanmadi")}
                      </div>
                      <div className="text-[12px] text-muted-foreground">{threadError}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectedId && loadThread(selectedId)}
                        className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {tx("Повторить", "Qayta urinish")}
                      </Button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center h-full">
                      <div className="w-12 h-12 rounded-[12px] bg-muted grid place-items-center text-muted-foreground">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="text-[13.5px] text-foreground font-semibold">
                        {tx("Сообщений пока нет", "Hozircha xabarlar yo‘q")}
                      </div>
                      <div className="text-[12px] text-muted-foreground max-w-xs">
                        {tx("Начните переписку — напишите клинике первым.", "Yozishmani boshlang — klinikaga birinchi bo‘lib yozing.")}
                      </div>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = String(m.sender_user_id) === String(user?.id);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "flex flex-col max-w-[78%]",
                            mine ? "ml-auto items-end" : "mr-auto items-start",
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words",
                              mine
                                ? "bg-[hsl(var(--brand))] text-white rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm",
                              m.__optimistic && "opacity-70",
                            )}
                          >
                            {m.body}
                          </div>
                          <div className="mt-1 px-1 text-[10.5px] text-muted-foreground inline-flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{roleLabel(m.sender_role)}</span>
                            <span className="opacity-50">·</span>
                            <span>{formatTime(m.created_at)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={threadEndRef} />
                </div>

                {/* Compose row */}
                <div className="border-t border-border p-3 shrink-0">
                  <form
                    className="flex min-w-0 items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSend();
                    }}
                    aria-busy={sending}
                  >
                    <label htmlFor="technician-message-body" className="sr-only">
                      {tx("Напишите сообщение клинике…", "Klinikaga xabar yozing…")}
                    </label>
                    <Input
                      id="technician-message-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={onComposeKeyDown}
                      placeholder={tx("Напишите сообщение клинике…", "Klinikaga xabar yozing…")}
                      disabled={sending}
                      className="h-11 min-w-0 flex-1"
                      aria-describedby="technician-message-status"
                    />
                    <Button
                      type="submit"
                      disabled={!body.trim() || sending}
                      className="min-h-11 min-w-11 shrink-0 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={tx("Отправить", "Yuborish")}
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">{tx("Отправить", "Yuborish")}</span>
                    </Button>
                  </form>
                  <p
                    id="technician-message-status"
                    role={sendError ? "alert" : "status"}
                    aria-live={sendError ? "assertive" : "polite"}
                    className={cn("mt-2 text-xs", sendError ? "text-destructive" : "sr-only")}
                  >
                    {sendError || (sending ? tx("Сообщение отправляется", "Xabar yuborilmoqda") : "")}
                  </p>
                  {refreshWarning && (
                    <div
                      className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
                      role="status"
                      aria-live="polite"
                    >
                      <span>{refreshWarning}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 border-amber-400 bg-white"
                        onClick={() => {
                          if (selectedId) {
                            void loadThread(selectedId, { preserveOnError: true });
                          }
                        }}
                      >
                        {tx("Обновить", "Yangilash")}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </TechnicianLayout>
  );
}
