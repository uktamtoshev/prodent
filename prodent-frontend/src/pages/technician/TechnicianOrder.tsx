import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleDot,
  Clock,
  CreditCard,
  FlaskConical,
  Loader2,
  MessageSquare,
  Package,
  Plus,
  Send,
  Stethoscope,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { LabOrderFilesPanel } from "@/components/technician/LabOrderFilesPanel";
import { DesignCard, DesignBadge, SectionTitle } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { clearPersistentClientRequestId, getPersistentClientRequestId } from "@/lib/crm-operations-api";
import {
  lab,
  type LabClarification,
  type LabMaterial,
  type LabMessage,
  type LabOrder,
  type LabOrderEvent,
  type LabOrderMaterial,
  type LabOrderStatus,
  type LabSettlement,
} from "@/lib/lab";
import {
  getLabStatusLabel,
  getNextLabStatus,
  LAB_PRODUCTION_FLOW,
  toTashkentOffsetDateTime,
} from "@/lib/lab-workflow";
import { getErrorMessage } from "@/lib/edge-function-error";
import { cn } from "@/lib/utils";
import { clearLabDraft, loadLabDraft, saveLabDraft } from "@/lib/lab-drafts";

function localeOf(language: string): string {
  return language === "uz" ? "uz-UZ" : "ru-RU";
}

function fmtMoney(v: number | null | undefined, language: string): string {
  if (v == null) return "—";
  return `${Math.round(Number(v)).toLocaleString(localeOf(language))} ${language === "uz" ? "so‘m" : "сум"}`;
}

// Forward flow: queued → … → ready → delivered. delivered/cancelled/declined terminal.
const FLOW = LAB_PRODUCTION_FLOW;
const TERMINAL = new Set<LabOrderStatus>(["delivered", "cancelled", "declined"]);

const STATUS_TONE: Record<string, "neutral" | "teal" | "amber" | "rose" | "emerald" | "sky" | "violet"> = {
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

function formatDateTime(ts: string | null | undefined, language: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(localeOf(language), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(ts: string | null | undefined, language: string): string {
  if (!ts) return "—";
  const d = new Date(String(ts).length <= 10 ? String(ts).slice(0, 10) + "T00:00:00" : ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(localeOf(language), { day: "numeric", month: "long", year: "numeric" });
}

function formatPrice(price: unknown, currency: string | null | undefined, language: string): string {
  if (price == null || price === "") return "—";
  const n = Number(price);
  if (Number.isNaN(n)) return String(price);
  return `${n.toLocaleString(localeOf(language))} ${currency || "UZS"}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[14px] text-foreground">{value ?? "—"}</div>
    </div>
  );
}

export default function TechnicianOrder() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const uz = language === "uz";

  const [order, setOrder] = useState<LabOrder | null>(null);
  const [events, setEvents] = useState<LabOrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  // Materials consumed on this order + the technician's stock (for the picker).
  const [orderMats, setOrderMats] = useState<LabOrderMaterial[]>([]);
  const [stock, setStock] = useState<LabMaterial[]>([]);
  const [matId, setMatId] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matBusy, setMatBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const pendingPaymentSync = useRef<{
    actor: string;
    scope: string;
    action: string;
  } | null>(null);
  const [settlements, setSettlements] = useState<LabSettlement[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [messages, setMessages] = useState<LabMessage[]>([]);
  const [clarifications, setClarifications] = useState<LabClarification[]>([]);
  const [clarification, setClarification] = useState("");
  const [proposedDueAt, setProposedDueAt] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError("Не указан идентификатор заказа");
      setLoading(false);
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      // Scoped fetch off the lab API: the order passport + its event timeline.
      const [{ events: evs, ...ord }, ledger] = await Promise.all([
        lab.getOrder(id),
        lab.listSettlements(id),
      ]);
      setOrder(ord);
      setEvents(Array.isArray(evs) ? evs : []);
      setSettlements(ledger);
      if (pendingPaymentSync.current) {
        const pending = pendingPaymentSync.current;
        clearPersistentClientRequestId(pending.actor, pending.scope, pending.action);
        pendingPaymentSync.current = null;
      }
      return true;
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Не удалось загрузить заказ"));
      setOrder(null);
      setEvents([]);
      setSettlements([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMaterials = useCallback(async () => {
    if (!id) return;
    try {
      const [om, st] = await Promise.all([lab.listOrderMaterials(id), lab.listMaterials()]);
      setOrderMats(om);
      setStock(st);
    } catch {
      // Non-fatal — the passport still renders without the materials block.
    }
  }, [id]);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const [thread, proposals] = await Promise.all([
        lab.listMessages(id),
        lab.listClarifications(id),
      ]);
      setMessages(thread);
      setClarifications(proposals);
    } catch (error: unknown) {
      setMessages([]);
      setClarifications([]);
      setMessagesError(getErrorMessage(error, "Не удалось загрузить переписку"));
    } finally {
      setMessagesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadMaterials();
    loadMessages();
  }, [load, loadMaterials, loadMessages]);

  useEffect(() => {
    if (!id || !user?.id) return;
    const draft = loadLabDraft(
      `clarification:${id}`,
      user.id,
      { message: "", dueAt: "", price: "" },
    );
    setClarification(draft.message);
    setProposedDueAt(draft.dueAt);
    setProposedPrice(draft.price);
  }, [id, user?.id]);

  useEffect(() => {
    if (!id || !user?.id) return;
    saveLabDraft(`clarification:${id}`, user.id, {
      message: clarification,
      dueAt: proposedDueAt,
      price: proposedPrice,
    });
  }, [clarification, id, proposedDueAt, proposedPrice, user?.id]);

  const materialsCost = useMemo(
    () => orderMats.reduce((s, m) => s + (Number(m.total_cost) || 0), 0),
    [orderMats],
  );

  const consumeMat = async () => {
    if (!id || !matId || !matQty) return;
    const qty = Number(matQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({ title: uz ? "Miqdorni kiriting" : "Укажите количество", variant: "destructive" });
      return;
    }
    setMatBusy(true);
    try {
      await lab.consumeMaterial(id, matId, qty);
      setMatId("");
      setMatQty("");
      await loadMaterials();
      toast({ title: uz ? "Material hisobdan chiqarildi" : "Материал списан" });
    } catch (error: unknown) {
      toast({ title: uz ? "Material hisobdan chiqarilmadi" : "Не удалось списать", description: getErrorMessage(error, "") || undefined, variant: "destructive" });
    } finally {
      setMatBusy(false);
    }
  };

  const undoMat = async (consumptionId: string) => {
    if (!id) return;
    setMatBusy(true);
    try {
      await lab.undoConsumeMaterial(id, consumptionId);
      await loadMaterials();
    } catch (error: unknown) {
      toast({ title: uz ? "Hisobdan chiqarish bekor qilinmadi" : "Не удалось отменить списание", description: getErrorMessage(error, "") || undefined, variant: "destructive" });
    } finally {
      setMatBusy(false);
    }
  };

  const settledAmount = useMemo(
    () => settlements.reduce((sum, entry) =>
      entry.entry_type === "REFUND"
        ? sum - Number(entry.amount || 0)
        : sum + Number(entry.amount || 0), 0),
    [settlements],
  );
  const remainingAmount = Math.max(0, Number(order?.price || 0) - settledAmount);

  useEffect(() => {
    if (remainingAmount > 0) setPayAmount(String(remainingAmount));
  }, [remainingAmount]);

  const recordPayment = async () => {
    if (!id || !order) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remainingAmount) {
      toast({ title: uz ? "To‘g‘ri summani kiriting" : "Укажите сумму не больше остатка", variant: "destructive" });
      return;
    }
    setPayBusy(true);
    try {
      const action = `lab-settlement:${id}:PAYMENT:${amount}`;
      const actor = user?.id || "technician";
      const scope = order.clinic_id || "lab";
      const clientRequestId = getPersistentClientRequestId(actor, scope, action);
      await lab.createSettlement(id, {
        entry_type: "PAYMENT",
        amount,
        currency: order.currency || "UZS",
        method: "CASH",
        note: "Payment recorded",
        client_request_id: clientRequestId,
      });
      pendingPaymentSync.current = { actor, scope, action };
      const refreshed = await load();
      if (!refreshed) {
        toast({
          title: uz ? "To‘lov yozildi" : "Платёж записан",
          description: uz
            ? "Ma’lumotlar yangilanmadi. Qayta yuklash tugamaguncha to‘lovni takrorlamang."
            : "Данные не обновились. Повторите только загрузку страницы.",
        });
      }
    } catch (error: unknown) {
      toast({ title: uz ? "To‘lov holati o‘zgarmadi" : "Не удалось изменить оплату", description: getErrorMessage(error, "") || undefined, variant: "destructive" });
    } finally {
      setPayBusy(false);
    }
  };

  const nextStatus = order ? getNextLabStatus(order.status) : null;
  const isTerminal = order ? TERMINAL.has(order.status) : false;

  // Timeline contains only server events. Never invent a completed production step.
  const timeline = useMemo(() => {
    return events.map((e) => ({
      from: e.from_status,
      to: e.to_status,
      at: e.created_at,
      note: e.note,
      actorRole: e.actor_role,
    }));
  }, [events]);

  // Workflow transitions go through the lab API only — the server validates the
  // step, guards who may move the order, and writes the event atomically.
  const advance = async (to: LabOrderStatus, _from: LabOrderStatus) => {
    if (!id) return;
    setAdvancing(true);
    try {
      if (to === "cancelled") {
        await lab.cancelOrder(id);
      } else {
        await lab.advanceOrder(id, to);
      }
      toast({
        title: to === "cancelled" ? (uz ? "Buyurtma bekor qilindi" : "Заказ отменён") : (uz ? "Bosqich yangilandi" : "Этап обновлён"),
        description: `${uz ? "Holat" : "Статус"}: ${getLabStatusLabel(to, language)}`,
      });
      await load();
    } catch (error: unknown) {
      toast({
        title: uz ? "Holat yangilanmadi" : "Не удалось обновить статус",
        description: getErrorMessage(error, uz ? "Qayta urinib ko‘ring." : "Попробуйте ещё раз."),
        variant: "destructive",
      });
    } finally {
      setAdvancing(false);
    }
  };

  // Incoming ('new') order: accept into the queue, or decline with a reason.
  const acceptOrder = async () => {
    if (!id) return;
    setAdvancing(true);
    try {
      await lab.acceptOrder(id);
      toast({ title: uz ? "Buyurtma qabul qilindi" : "Заказ принят", description: uz ? "Buyurtma navbatga qo‘shildi." : "Заказ добавлен в очередь." });
      await load();
    } catch (error: unknown) {
      toast({
        title: uz ? "Buyurtma qabul qilinmadi" : "Не удалось принять заказ",
        description: getErrorMessage(error, uz ? "Qayta urinib ko‘ring." : "Попробуйте ещё раз."),
        variant: "destructive",
      });
    } finally {
      setAdvancing(false);
    }
  };

  const declineOrder = async () => {
    if (!id) return;
    const reason = window.prompt(uz ? "Rad etish sababi (klinika ko‘radi):" : "Причина отказа (увидит клиника):") ?? undefined;
    if (reason === undefined) return; // dialog dismissed
    setAdvancing(true);
    try {
      await lab.declineOrder(id, reason.trim() || undefined);
      toast({ title: uz ? "Buyurtma rad etildi" : "Заказ отклонён", description: uz ? "Klinika rad javobingizni oladi." : "Клиника получит ваш отказ." });
      await load();
    } catch (error: unknown) {
      toast({
        title: uz ? "Buyurtma rad etilmadi" : "Не удалось отклонить заказ",
        description: getErrorMessage(error, uz ? "Qayta urinib ko‘ring." : "Попробуйте ещё раз."),
        variant: "destructive",
      });
    } finally {
      setAdvancing(false);
    }
  };

  const askClarification = async () => {
    if (!id || messageBusy) return;
    setMessageBusy(true);
    try {
      if (!navigator.onLine) throw new Error("offline");
      const dueAt = toTashkentOffsetDateTime(proposedDueAt);
      const price = proposedPrice ? Number(proposedPrice) : undefined;
      if (price != null && (!Number.isFinite(price) || price < 0)) {
        throw new Error("invalid_price");
      }
      if (dueAt || price != null) {
        await lab.createClarification(id, {
          message: clarification.trim(),
          due_at: dueAt,
          price,
          currency: order?.currency || "UZS",
        });
      } else {
        await lab.sendClarification(id, clarification, { online: true });
      }
      setClarification("");
      setProposedDueAt("");
      setProposedPrice("");
      clearLabDraft(`clarification:${id}`, user?.id);
      await loadMessages();
      toast({
        title: language === "uz" ? "Savol yuborildi" : "Уточнение отправлено",
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "");
      toast({
        title:
          message === "clarification_required"
            ? language === "uz"
              ? "Savol matnini kiriting"
              : "Напишите, что нужно уточнить"
            : language === "uz"
              ? "Savol yuborilmadi"
              : "Уточнение не отправлено",
        description:
          message === "offline"
            ? language === "uz"
              ? "Internet aloqasini tekshiring."
              : "Проверьте подключение к интернету."
            : message || undefined,
        variant: "destructive",
      });
    } finally {
      setMessageBusy(false);
    }
  };

  const subtitle = order?.order_number != null ? `№${order.order_number}` : id ? `#${String(id).slice(0, 8)}` : "";

  return (
    <TechnicianLayout
      title={language === "uz" ? "Buyurtma" : "Заказ"}
      subtitle={subtitle}
    >
      <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
        <Link
          to="/technician"
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="w-4 h-4" /> {uz ? "Buyurtmalar ro‘yxatiga" : "К списку заказов"}
        </Link>

        {loading ? (
          <DesignCard className="flex items-center justify-center gap-2 py-20 text-[13.5px] text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {uz ? "Buyurtma yuklanmoqda…" : "Загрузка заказа…"}
          </DesignCard>
        ) : error ? (
          <DesignCard className="flex flex-col items-center justify-center gap-3 py-20 text-center" role="alert">
            <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-[14px] text-foreground font-semibold">{uz ? "Buyurtma topilmadi" : "Заказ не найден"}</div>
            <div className="text-[12.5px] text-muted-foreground max-w-sm">{error}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>
                {uz ? "Qayta urinish" : "Повторить"}
              </Button>
              <Button asChild size="sm">
                <Link to="/technician">{uz ? "Ro‘yxatga" : "К списку"}</Link>
              </Button>
            </div>
          </DesignCard>
        ) : !order ? (
          <DesignCard className="py-20 text-center text-muted-foreground text-[13.5px]">{uz ? "Buyurtma topilmadi." : "Заказ не найден."}</DesignCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-5">
            {/* Left: passport */}
            <div className="space-y-5">
              <DesignCard>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[20px] font-bold tracking-tight font-display text-foreground">
                        {order.work_type}
                      </h2>
                      {order.priority === "urgent" && <DesignBadge tone="rose">{uz ? "Shoshilinch" : "Срочно"}</DesignBadge>}
                    </div>
                    <div className="text-[12.5px] text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {uz ? "Yaratilgan" : "Создан"} {formatDateTime(order.created_at, language)}
                    </div>
                  </div>
                  <DesignBadge tone={STATUS_TONE[order.status] ?? "neutral"}>
                    <Wrench className="w-3 h-3" /> {getLabStatusLabel(order.status, language)}
                  </DesignBadge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5 mt-6">
                  <Field label={uz ? "Buyurtma №" : "№ заказа"} value={order.order_number != null ? `№${order.order_number}` : "—"} />
                  <Field label={uz ? "Bemor" : "Пациент"} value={order.patient_name || "—"} />
                  <Field
                    label={uz ? "Ustuvorlik" : "Приоритет"}
                    value={order.priority === "urgent" ? (uz ? "Shoshilinch" : "Срочный") : (uz ? "Oddiy" : "Обычный")}
                  />
                  <Field
                    label={uz ? "Material" : "Материал"}
                    value={
                      order.material ? (
                        <span className="inline-flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" /> {order.material}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field label={uz ? "Tish" : "Зуб"} value={order.tooth || "—"} />
                  <Field label={uz ? "Rang" : "Оттенок"} value={order.shade || "—"} />
                  <Field
                    label={uz ? "Muddat" : "Срок"}
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" /> {formatDate(order.due_date, language)}
                      </span>
                    }
                  />
                  <Field label={uz ? "Narx" : "Цена"} value={formatPrice(order.price, order.currency, language)} />
                  <Field
                    label={uz ? "Shifokor" : "Врач"}
                    value={
                      order.doctor_id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" /> {uz ? "Tayinlangan" : "Назначен"}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                </div>

                {order.notes && (
                  <div className="mt-6 pt-5 border-t border-border">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {uz ? "Izohlar" : "Заметки"}
                    </div>
                    <p className="mt-1.5 text-[13.5px] text-foreground whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}
              </DesignCard>

              {id && <LabOrderFilesPanel orderId={id} readOnly={isTerminal} />}

              {/* Order clarification/messages. The server decides the sender from JWT. */}
              <DesignCard>
                <SectionTitle
                  subtitle={
                    language === "uz"
                      ? "muddat, narx va buyurtma tafsilotlari"
                      : "срок, цена и детали заказа"
                  }
                >
                  {language === "uz" ? "Aniqlashtirish" : "Уточнения"}
                </SectionTitle>

                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-[10px] border border-border bg-muted/20 p-3">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status" aria-live="polite">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {language === "uz" ? "Xabarlar yuklanmoqda…" : "Загрузка сообщений…"}
                    </div>
                  ) : messagesError ? (
                    <div className="space-y-2 py-5 text-center" role="alert">
                      <p className="text-sm text-destructive">{messagesError}</p>
                      <Button variant="outline" size="sm" onClick={loadMessages}>
                        {language === "uz" ? "Qayta urinish" : "Повторить"}
                      </Button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      <MessageSquare className="mx-auto mb-2 h-5 w-5" />
                      {language === "uz"
                        ? "Hozircha aniqlashtirishlar yo‘q."
                        : "Уточнений пока нет."}
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="rounded-[9px] border border-border bg-card px-3 py-2">
                        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                          <span>{message.sender_role || (language === "uz" ? "Ishtirokchi" : "Участник")}</span>
                          <time dateTime={message.created_at}>{formatDateTime(message.created_at, language)}</time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-[13px]">{message.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {clarifications.length > 0 && (
                    <div className="space-y-2" aria-label={language === "uz" ? "Takliflar" : "Предложения"}>
                      {clarifications.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[9px] border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
                            <span>
                              {item.status === "PENDING"
                                ? language === "uz"
                                  ? "Tasdiqlash kutilmoqda"
                                  : "Ожидает подтверждения"
                                : language === "uz"
                                  ? "Ko‘rib chiqildi"
                                  : "Рассмотрено"}
                            </span>
                            {item.proposed_due_at && <span>{formatDateTime(item.proposed_due_at, language)}</span>}
                            {item.proposed_price != null && (
                              <span>{formatPrice(item.proposed_price, item.proposed_currency || order.currency, language)}</span>
                            )}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-[12px] text-muted-foreground">
                      <span>{language === "uz" ? "Yangi muddat (ixtiyoriy)" : "Новый срок (необязательно)"}</span>
                      <Input
                        type="datetime-local"
                        value={proposedDueAt}
                        onChange={(event) => setProposedDueAt(event.target.value)}
                        disabled={messageBusy || isTerminal}
                      />
                    </label>
                    <label className="space-y-1 text-[12px] text-muted-foreground">
                      <span>{language === "uz" ? "Yangi narx (ixtiyoriy)" : "Новая цена (необязательно)"}</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={proposedPrice}
                        onChange={(event) => setProposedPrice(event.target.value)}
                        disabled={messageBusy || isTerminal}
                      />
                    </label>
                  </div>
                  <Textarea
                    value={clarification}
                    onChange={(event) => setClarification(event.target.value)}
                    placeholder={
                      language === "uz"
                        ? "Masalan: rangni va kerakli muddatni aniqlashtiring"
                        : "Например: уточните оттенок и желаемый срок"
                    }
                    rows={3}
                    maxLength={2000}
                    disabled={messageBusy || isTerminal}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground" aria-live="polite">
                      {clarification.length}/2000
                    </span>
                    <Button
                      onClick={askClarification}
                      disabled={messageBusy || isTerminal || !clarification.trim()}
                    >
                      {messageBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {language === "uz" ? "Savol yuborish" : "Отправить уточнение"}
                    </Button>
                  </div>
                </div>
              </DesignCard>

              {/* Timeline */}
              <DesignCard>
                <SectionTitle subtitle={uz ? "bosqichlar bo‘yicha harakat" : "движение по этапам"}>{uz ? "Tarix" : "История"}</SectionTitle>
                <ol className="relative ml-1.5 mt-2 border-l border-border">
                  {timeline.length === 0 ? (
                    <li className="ml-5 py-3 text-[13px] text-muted-foreground">
                      {language === "uz"
                        ? "Hozircha ishlab chiqarish voqealari yo‘q."
                        : "Событий производства пока нет."}
                    </li>
                  ) : timeline.map((step, i) => (
                    <li key={i} className="ml-5 pb-5 last:pb-0 relative">
                      <span
                        className={cn(
                          "absolute -left-[26px] top-0.5 w-3.5 h-3.5 rounded-full ring-4 ring-card grid place-items-center",
                          step.to === "cancelled" ? "bg-destructive" : "bg-[hsl(var(--brand))]",
                        )}
                      >
                        <CircleDot className="h-2 w-2 text-primary-foreground" aria-hidden="true" />
                      </span>
                      <div className="flex items-center gap-2 flex-wrap text-[13px]">
                        {step.from && (
                          <>
                          <span className="text-muted-foreground">{getLabStatusLabel(step.from as LabOrderStatus, language)}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          </>
                        )}
                        <span className="font-semibold text-foreground">{getLabStatusLabel(step.to as LabOrderStatus, language)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(step.at, language)}
                        {step.actorRole ? ` · ${step.actorRole}` : ""}
                      </div>
                      {step.note && <div className="text-[12px] text-muted-foreground mt-0.5">{step.note}</div>}
                    </li>
                  ))}
                </ol>
              </DesignCard>

              {/* Materials consumed on this order */}
              <DesignCard>
                <div className="flex items-center justify-between">
                  <SectionTitle subtitle={uz ? "ombordan buyurtmaga hisobdan chiqarish" : "списание со склада на этот заказ"}>{uz ? "Materiallar" : "Материалы"}</SectionTitle>
                  {materialsCost > 0 && (
                    <div className="text-[12.5px] text-muted-foreground">
                      {uz ? "Tannarx" : "Себестоимость"}: <span className="font-semibold text-foreground tabular-nums">{fmtMoney(materialsCost, language)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  {orderMats.length === 0 ? (
                    <div className="text-[13px] text-muted-foreground py-3 text-center">
                      {uz ? "Materiallar hali hisobdan chiqarilmagan." : "Материалы ещё не списаны."}
                    </div>
                  ) : (
                    orderMats.map((m) => (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-[13px]"
                      >
                        <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground truncate flex-1">{m.material_name || (uz ? "Material" : "Материал")}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {Number(m.qty)} {m.material_unit || ""}
                        </span>
                        <span className="tabular-nums text-foreground w-24 text-right">{fmtMoney(m.total_cost, language)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-destructive"
                          disabled={matBusy}
                          onClick={() => undoMat(m.id)}
                          title={uz ? "Omborga qaytarish" : "Вернуть на склад"}
                          aria-label={uz ? "Materialni omborga qaytarish" : "Вернуть материал на склад"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add-consumption row */}
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
                  <select
                    value={matId}
                    onChange={(e) => setMatId(e.target.value)}
                    className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{uz ? "Materialni tanlang…" : "Выберите материал…"}</option>
                    {stock.map((s) => (
                      <option key={s.id} value={s.id}>
                          {s.name} · {uz ? "qoldiq" : "остаток"} {Number(s.stock_qty)} {s.unit}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={matQty}
                    onChange={(e) => setMatQty(e.target.value)}
                    placeholder={uz ? "miqdor" : "кол-во"}
                    className="w-full sm:w-24"
                  />
                  <Button onClick={consumeMat} disabled={matBusy || !matId || !matQty}>
                    {matBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>
              </DesignCard>
            </div>

            {/* Right: stage controls */}
            <div className="space-y-5">
              <DesignCard>
                <SectionTitle subtitle={uz ? "bosqichni boshqarish" : "управление этапом"}>{uz ? "Amallar" : "Действия"}</SectionTitle>
                <div className="space-y-3 mt-1">
                  {order.status === "new" ? (
                    <>
                      <Button className="w-full" disabled={advancing} onClick={acceptOrder}>
                        {advancing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4 mr-2" />
                        )}
                        {uz ? "Ishga qabul qilish" : "Принять в работу"}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={advancing}
                        onClick={declineOrder}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> {uz ? "Buyurtmani rad etish" : "Отклонить заказ"}
                      </Button>
                      <p className="text-[12px] text-muted-foreground text-center pt-1">
                        {uz ? "Klinikadan kelgan buyurtmani navbatga qabul qiling yoki rad eting." : "Входящий заказ от клиники — примите его в очередь или откажитесь."}
                      </p>
                    </>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        disabled={isTerminal || advancing || !nextStatus}
                        onClick={() => nextStatus && advance(nextStatus, order.status)}
                      >
                        {advancing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4 mr-2" />
                        )}
                        {isTerminal
                          ? (uz ? "Buyurtma yakunlandi" : "Заказ завершён")
                          : nextStatus === "delivered"
                            ? (uz ? "Buyurtmani topshirish" : "Выдать заказ")
                            : `${uz ? "Keyingi bosqich" : "Следующий этап"}: ${getLabStatusLabel(nextStatus, language)}`}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={isTerminal || advancing}
                          >
                            <XCircle className="mr-2 h-4 w-4" aria-hidden="true" /> {uz ? "Buyurtmani bekor qilish" : "Отменить заказ"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{uz ? "Buyurtmani bekor qilasizmi?" : "Отменить заказ?"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {uz
                                ? "Bu amal buyurtmani yakuniy bekor qilingan holatga o‘tkazadi."
                                : "Заказ перейдёт в конечный статус «Отменён». Это действие нельзя продолжить как обычный этап."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={advancing}>
                              {uz ? "Orqaga" : "Назад"}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              disabled={advancing}
                              onClick={() => advance("cancelled", order.status)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {uz ? "Bekor qilishni tasdiqlash" : "Подтвердить отмену"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {isTerminal && (
                        <p className="text-[12px] text-muted-foreground text-center pt-1">
                          {uz ? "Yakunlangan buyurtmani o‘zgartirib bo‘lmaydi" : "Заказ в терминальном статусе"} ({getLabStatusLabel(order.status, language)}).
                        </p>
                      )}
                    </>
                  )}
                </div>
              </DesignCard>

              {/* Payment (technician's receivables bookkeeping) */}
              {order.status !== "cancelled" && order.status !== "declined" && (
                <DesignCard>
                  <SectionTitle subtitle={uz ? "klinikadan to‘lov" : "оплата от клиники"}>{uz ? "Moliya" : "Финансы"}</SectionTitle>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[13px]">
                      <div className="text-muted-foreground">{uz ? "Buyurtma summasi" : "Сумма заказа"}</div>
                      <div className="font-semibold text-foreground tabular-nums">
                        {formatPrice(order.price, order.currency, language)}
                      </div>
                    </div>
                    <DesignBadge tone={remainingAmount === 0 ? "emerald" : "amber"}>
                      {remainingAmount === 0 ? (uz ? "To‘langan" : "Оплачен") : (uz ? "Qoldiq bor" : "Есть остаток")}
                    </DesignBadge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                    <div>{uz ? "To‘langan" : "Оплачено"}: <b>{formatPrice(settledAmount, order.currency, language)}</b></div>
                    <div>{uz ? "Qoldiq" : "Остаток"}: <b>{formatPrice(remainingAmount, order.currency, language)}</b></div>
                  </div>
                  {remainingAmount > 0 && (
                    <Input className="mt-3" type="number" min="1" max={remainingAmount} value={payAmount} onChange={(event) => setPayAmount(event.target.value)} aria-label={uz ? "To‘lov summasi" : "Сумма платежа"} />
                  )}
                  <Button
                    variant="default"
                    className="w-full mt-3"
                    disabled={payBusy || remainingAmount === 0}
                    onClick={recordPayment}
                  >
                    {payBusy ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    {uz ? "To‘lovni yozish" : "Записать платёж"}
                  </Button>
                </DesignCard>
              )}

              <DesignCard>
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {uz ? "Bosqichlar" : "Этапы"}
                </div>
                <div className="space-y-1.5">
                  {FLOW.map((s) => {
                    const curIdx = FLOW.indexOf(order.status);
                    const sIdx = FLOW.indexOf(s);
                    const done = curIdx >= 0 && sIdx < curIdx && !TERMINAL.has(order.status);
                    const current = s === order.status;
                    return (
                      <div
                        key={s}
                        className={cn(
                          "flex items-center gap-2 text-[13px] px-2.5 py-1.5 rounded-[8px]",
                          current && "bg-[hsl(var(--brand-50))] font-semibold text-[hsl(var(--brand-700))]",
                          !current && done && "text-muted-foreground",
                          !current && !done && "text-foreground/70",
                        )}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            current
                              ? "bg-[hsl(var(--brand))]"
                              : done
                                ? "bg-[hsl(var(--brand))]/40"
                                : "bg-muted-foreground/40",
                          )}
                        />
                        {getLabStatusLabel(s, language)}
                      </div>
                    );
                  })}
                  {order.status === "cancelled" && (
                    <div className="flex items-center gap-2 rounded-[8px] bg-destructive/10 px-2.5 py-1.5 text-[13px] font-semibold text-destructive">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
                      {getLabStatusLabel("cancelled", language)}
                    </div>
                  )}
                </div>
              </DesignCard>
            </div>
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
