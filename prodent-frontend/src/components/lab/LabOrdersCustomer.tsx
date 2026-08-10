// Customer (clinic / doctor) side of the dental-lab module. Both crm/Laboratory
// and doctor/DoctorLaboratory render this panel inside their own layout. All I/O
// goes through the secure lab API (lib/lab.ts) — the caller's clinic/doctor scope
// is enforced server-side, so this component never picks a clinic_id itself.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  FlaskConical,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { lab, LabClarification, LabOrder, LabOrderEvent, LabMessage, LabTechnician, LabServiceItem } from "@/lib/lab";
import { cn } from "@/lib/utils";
import { LabOrderFilesPanel } from "@/components/technician/LabOrderFilesPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { localeFor } from "@/lib/localization";
import {
  clearLabDraft,
  loadLabDraft,
  loadOrCreateLabRequestId,
  saveLabDraft,
} from "@/lib/lab-drafts";
import { getLabStatusLabel } from "@/lib/lab-workflow";

// ── Status model (mirrors the technician cabinet) ────────────────────────────
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  delivered: "default",
  cancelled: "destructive",
  declined: "destructive",
};

const TERMINAL = new Set(["delivered", "cancelled", "declined"]);
// Production stages the customer sees as "в работе".
const IN_WORK = new Set(["queued", "model", "wax", "milling", "frame", "glaze", "ready"]);

/** Срезы заказов из макета. «Просрочено» здесь нет: срок сдачи в ответе
    приходит не всегда, а показывать пустой срез как рабочий нельзя. */
type LabTab = "all" | "new" | "inWork" | "ready";

function fmtDate(v: string | null | undefined, language: string): string {
  if (!v) return "—";
  const d = new Date(String(v).length <= 10 ? String(v).slice(0, 10) + "T00:00:00" : v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(localeFor(language), { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(v: string | null | undefined, language: string): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(localeFor(language), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Group digits with spaces for display: "2000" -> "2 000".
const groupDigits = (s: string): string =>
  (s || "").replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function fmtPrice(v: number | null, currency: string | null, language: string, t: (key: string) => string): string {
  if (v == null) return "—";
  const cur = (currency || "UZS").toUpperCase();
  const amount = Number(v).toLocaleString(localeFor(language));
  return cur === "USD" ? `$${amount}` : `${amount} ${cur === "UZS" ? t("labCustomer.currencyUzs") : cur}`;
}

function roleLabel(role: string | null | undefined, tx: (key: string) => string): string {
  if (!role) return "";
  const key = `role.${role}`;
  const label = tx(key);
  return label === `labCustomer.${key}` ? role : label;
}

interface NewOrderForm {
  technician_id: string;
  work_type: string;
  material: string;
  tooth: string;
  shade: string;
  patient_name: string;
  priority: string;
  due_date: string;
  price: string;
  currency: string;
  notes: string;
}

const EMPTY_FORM: NewOrderForm = {
  technician_id: "",
  work_type: "",
  material: "",
  tooth: "",
  shade: "",
  patient_name: "",
  priority: "normal",
  due_date: "",
  price: "",
  currency: "UZS",
  notes: "",
};

export function LabOrdersCustomer() {
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const tx = useCallback((key: string) => t(`labCustomer.${key}`), [t]);
  const [searchParams] = useSearchParams();
  const sourceContext = useMemo(
    () => ({
      medical_record_id: searchParams.get("medical_record_id") || undefined,
      treatment_plan_id: searchParams.get("treatment_plan_id") || undefined,
      treatment_plan_item_id: searchParams.get("treatment_plan_item_id") || undefined,
      patient_id: searchParams.get("patient_id") || undefined,
    }),
    [searchParams],
  );

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<LabTab>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await lab.listOrders());
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : undefined) || tx("loadError"));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (sourceContext.medical_record_id || sourceContext.treatment_plan_id) {
      setCreateOpen(true);
    }
  }, [sourceContext.medical_record_id, sourceContext.treatment_plan_id]);

  const kpis = useMemo(() => {
    const active = orders.filter((o) => IN_WORK.has(o.status) || o.status === "new").length;
    const awaiting = orders.filter((o) => o.status === "new").length;
    const ready = orders.filter((o) => o.status === "ready").length;
    /**
     * У техников в работе — это принятые заказы, кроме новых и уже готовых.
     * Новый заказ техник ещё не взял, готовый уже сделал: складывать их в одно
     * число «в работе» значит показывать врачу больше загрузки, чем есть.
     */
    const inWork = orders.filter(
      (o) => IN_WORK.has(o.status) && o.status !== "ready",
    ).length;
    /** Сумма незавершённых заказов. Поле называется price, а не total_cost:
     * total_cost принадлежит материалам заказа (LabOrderMaterial), и обращение
     * к нему давало бы ноль на каждом заказе. */
    const amount = orders
      .filter((o) => !TERMINAL.has(o.status))
      .reduce((sum, o) => sum + Number(o.price ?? 0), 0);
    return { total: orders.length, active, awaiting, ready, inWork, amount };
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...orders].sort((a, b) => {
      const at = TERMINAL.has(a.status) ? 1 : 0;
      const bt = TERMINAL.has(b.status) ? 1 : 0;
      if (at !== bt) return at - bt;
      return Number(b.order_number ?? 0) - Number(a.order_number ?? 0);
    });
    const byTab = sorted.filter((o) => {
      if (tab === "all") return true;
      if (tab === "new") return o.status === "new";
      if (tab === "ready") return o.status === "ready";
      return IN_WORK.has(o.status) && o.status !== "ready";
    });
    if (!q) return byTab;
    return byTab.filter((o) =>
      [o.work_type, o.patient_name, o.technician_name, String(o.order_number)]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q)),
    );
  }, [orders, query, tab]);

  return (
    <div className="space-y-6">
      {/* Срезы заказов вкладками, как в макете. Считаются из статуса, который
          уже приходит в заказе. */}
      <div className="flex flex-wrap items-center gap-0.5">
        {([
          { key: "all" as const, label: tx("totalOrders"), n: kpis.total },
          { key: "new" as const, label: tx("awaitingTechnician"), n: kpis.awaiting },
          { key: "inWork" as const, label: tx("inProgress"), n: kpis.inWork },
          { key: "ready" as const, label: tx("readyForHandoff"), n: kpis.ready },
        ]).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={cn(
              "cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === item.key
                ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.n > 0 && (
              <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                {item.n}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Четыре показателя эталона. Все считаются из уже загруженных заказов:
            статус и total_cost приходят в самом заказе, новых запросов нет.
            «Всего заказов» уступило место сумме: количество видно по списку
            ниже, а денег на экране не было вовсе. */}
        {[
          { l: tx("activeOrders"), v: kpis.active },
          { l: tx("inProgress"), v: kpis.inWork },
          { l: tx("readyForHandoff"), v: kpis.ready },
          { l: tx("ordersAmount"), v: fmtPrice(kpis.amount, "UZS", language, t) },
        ].map((s) => (
          <div key={s.l} className="rounded-panel border border-border bg-card px-card-x py-3">
            <div className="text-meta text-muted-foreground font-medium">{s.l}</div>
            <div className="mt-1 text-kpi tabular-nums text-foreground font-heading">
              {loading ? "—" : s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tx("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> {tx("newOrder")}
        </Button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[70px,1fr,1fr,150px,130px] gap-2 px-5 py-3 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
          <div>№</div>
          <div>{tx("workAndPatient")}</div>
          <div>{tx("technician")}</div>
          <div>{tx("statusLabel")}</div>
          <div>{tx("deadline")}</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-cell">
            <Loader2 className="h-4 w-4 animate-spin" /> {tx("loadingOrders")}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-11 h-11 rounded-[12px] bg-destructive/10 grid place-items-center text-destructive">
              <AlertCircle className="w-5 h-5" />
            </div>
              <div className="text-cell text-foreground font-medium">{tx("loadError")}</div>
            <div className="text-xs text-muted-foreground max-w-sm">{error}</div>
            <Button variant="outline" size="sm" onClick={load}>
                {tx("retry")}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="w-11 h-11 rounded-[12px] bg-muted grid place-items-center text-muted-foreground">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="text-base text-foreground font-semibold">
                {query ? tx("nothingFound") : tx("noOrders")}
            </div>
            <div className="text-meta text-muted-foreground">
                {query ? tx("changeQuery") : tx("createFirst")}
            </div>
          </div>
        ) : (
          visible.map((o) => (
            <button
              key={o.id}
              onClick={() => setDetailId(o.id)}
              className="w-full text-left grid grid-cols-[70px,1fr,1fr,150px,130px] gap-2 px-5 py-4 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors"
            >
              <div className="font-mono text-xs text-muted-foreground tabular-nums">
                {o.order_number != null ? `№${o.order_number}` : String(o.id).slice(0, 6)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate flex items-center gap-1.5">
                  {o.work_type}
                  {o.priority === "urgent" && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{tx("urgentBadge")}</Badge>
                  )}
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
                  {o.patient_name || tx("withoutPatient")}
                </div>
              </div>
              <div className="min-w-0 text-sm text-foreground truncate">
                {o.technician_name || "—"}
              </div>
              <div>
                <Badge variant={STATUS_VARIANT[o.status] || "secondary"}>{getLabStatusLabel(o.status, t)}</Badge>
                {o.status === "declined" && o.declined_reason && (
                  <div className="text-[11px] text-destructive mt-1 truncate">{o.declined_reason}</div>
                )}
              </div>
              <div className="text-meta text-muted-foreground tabular-nums inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> {fmtDate(o.due_date, language)}
              </div>
            </button>
          ))
        )}
      </div>

      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sourceContext={sourceContext}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
      />

      <OrderDetailDialog
        orderId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={load}
      />
    </div>
  );
}

// ── Create dialog ────────────────────────────────────────────────────────────

function CreateOrderDialog({
  open,
  onOpenChange,
  onCreated,
  sourceContext,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  sourceContext: {
    medical_record_id?: string;
    treatment_plan_id?: string;
    treatment_plan_item_id?: string;
    patient_id?: string;
  };
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const tx = useCallback((key: string) => t(`labCustomer.${key}`), [t]);
  const [form, setForm] = useState<NewOrderForm>(EMPTY_FORM);
  const [techs, setTechs] = useState<LabTechnician[]>([]);
  const [services, setServices] = useState<LabServiceItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(loadLabDraft("new-order", user?.id, EMPTY_FORM));
    setServices([]);
    // Only the customer's favorite labs ("Мои лаборатории") are offered here.
    lab
      .listTechnicians()
      .then((list) => setTechs(list.filter((t) => t.is_favorite)))
      .catch(() => setTechs([]));
  }, [open, user?.id]);

  useEffect(() => {
    if (open) saveLabDraft("new-order", user?.id, form);
  }, [form, open, user?.id]);

  const set = (k: keyof NewOrderForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // When a technician is picked, load their price-list so the customer can pick a
  // standard work (which auto-fills the price).
  const pickTechnician = (id: string) => {
    set("technician_id", id);
    setServices([]);
    lab.technicianServices(id).then(setServices).catch(() => setServices([]));
  };

  // Apply a price-list entry: fill work type + its price in one tap.
  const applyService = (s: LabServiceItem) =>
    setForm((f) => ({ ...f, work_type: s.work_type, price: s.price != null ? String(s.price) : f.price }));

  const submit = async () => {
    if (!form.technician_id) {
      toast({ title: tx("selectTechnicianError"), variant: "destructive" });
      return;
    }
    if (!form.work_type.trim()) {
      toast({ title: tx("workTypeError"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const clientRequestId = loadOrCreateLabRequestId("new-order", user?.id);
      await lab.createOrder({
        client_request_id: clientRequestId,
        technician_id: form.technician_id,
        work_type: form.work_type.trim(),
        material: form.material.trim() || null,
        tooth: form.tooth.trim() || null,
        shade: form.shade.trim() || null,
        patient_name: form.patient_name.trim() || null,
        priority: form.priority || "normal",
        due_date: form.due_date || null,
        price: form.price ? Number(form.price) : null,
        currency: form.currency || "UZS",
        notes: form.notes.trim() || null,
        ...sourceContext,
      });
      toast({ title: tx("orderSent"), description: tx("orderSentDescription") });
      clearLabDraft("new-order", user?.id);
      clearLabDraft("new-order-request-id", user?.id);
      onCreated();
    } catch (e: unknown) {
      toast({
        title: tx("createError"),
        description: (e instanceof Error ? e.message : undefined) || tx("tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tx("createTitle")}</DialogTitle>
          <DialogDescription>
            {tx("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>
            {tx("dentalTechnician")}{" "}
              <span className="text-xs font-normal text-muted-foreground">({tx("fromFavorites")})</span>{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Select value={form.technician_id} onValueChange={pickTechnician}>
              <SelectTrigger>
              <SelectValue placeholder={tx("selectTechnician")} />
              </SelectTrigger>
              <SelectContent>
                {techs.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {tx("noFavoriteLabs")}
                  </div>
                ) : (
                  techs.map((tch) => (
                    <SelectItem key={tch.id} value={tch.id}>
                      {tch.full_name || tch.id.slice(0, 8)}
                      {tch.city ? ` · ${tch.city}` : ""}
                      {tch.service_count > 0 ? ` · ${tch.service_count} ${tx("servicesUnit")}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {services.length > 0 && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                {tx("technicianPriceHint")}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applyService(s)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-accent transition-colors"
                  >
                    {s.work_type}
                    {s.price != null && (
                      <span className="text-muted-foreground tabular-nums">
                        {Number(s.price).toLocaleString(localeFor(language))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="col-span-2 space-y-1.5">
            <Label>
              {tx("workType")} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.work_type}
              onChange={(e) => set("work_type", e.target.value)}
              placeholder={tx("workTypePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{tx("material")}</Label>
            <Input
              value={form.material}
              onChange={(e) => set("material", e.target.value)}
              placeholder="IPS e.max ZirCAD"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{tx("patient")}</Label>
            <Input
              value={form.patient_name}
              onChange={(e) => set("patient_name", e.target.value)}
              placeholder={tx("patientPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
              <Label>{tx("tooth")}</Label>
            <Input value={form.tooth} onChange={(e) => set("tooth", e.target.value)} placeholder="36" />
          </div>
          <div className="space-y-1.5">
              <Label>{tx("shade")}</Label>
            <Input value={form.shade} onChange={(e) => set("shade", e.target.value)} placeholder="A2" />
          </div>
          <div className="space-y-1.5">
            <Label>{tx("priority")}</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{tx("normalPriority")}</SelectItem>
                <SelectItem value="urgent">{tx("urgentPriority")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
              <Label>{tx("deadline")}</Label>
            <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
              <Label>{tx("estimatedPrice")}</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={groupDigits(form.price)}
                onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="flex-1"
              />
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">{tx("currencyUzs")} (UZS)</SelectItem>
                  <SelectItem value="USD">{tx("currencyUsd")} ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{tx("notesForTechnician")}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={tx("notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tx("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tx("sendOrder")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail dialog (passport + timeline + chat + cancel) ──────────────────────

function OrderDetailDialog({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const tx = useCallback((key: string) => t(`labCustomer.${key}`), [t]);
  const [order, setOrder] = useState<(LabOrder & { events: LabOrderEvent[] }) | null>(null);
  const [messages, setMessages] = useState<LabMessage[]>([]);
  const [clarifications, setClarifications] = useState<LabClarification[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const threadEnd = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const [o, msgs, proposals] = await Promise.all([
        lab.getOrder(orderId),
        lab.listMessages(orderId),
        lab.listClarifications(orderId),
      ]);
      setOrder(o);
      setMessages(msgs);
      setClarifications(proposals);
    } catch (e: unknown) {
      toast({ title: tx("openOrderError"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      onClose();
    } finally {
      setLoading(false);
    }
  }, [orderId, toast, onClose, tx]);

  useEffect(() => {
    if (orderId) load();
    else {
      setOrder(null);
      setMessages([]);
      setClarifications([]);
      setBody("");
    }
  }, [orderId, load]);

  useEffect(() => {
    if (!orderId || !user?.id) return;
    setBody(loadLabDraft(`customer-message:${orderId}`, user.id, ""));
  }, [orderId, user?.id]);

  useEffect(() => {
    if (!orderId || !user?.id) return;
    saveLabDraft(`customer-message:${orderId}`, user.id, body);
  }, [body, orderId, user?.id]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async () => {
    const text = body.trim();
    if (!text || !orderId || sending) return;
    setSending(true);
    try {
      await lab.sendMessage(orderId, text, { online: navigator.onLine });
      clearLabDraft(`customer-message:${orderId}`, user?.id);
      setBody("");
      setMessages(await lab.listMessages(orderId));
    } catch (e: unknown) {
      toast({ title: tx("messageError"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (!orderId) return;
    const reason = window.prompt(tx("cancelPrompt")) ?? undefined;
    if (reason === undefined) return;
    setCancelling(true);
    try {
      await lab.cancelOrder(orderId, reason.trim() || undefined);
      toast({ title: tx("orderCancelled") });
      await load();
      onChanged();
    } catch (e: unknown) {
      toast({ title: tx("cancelError"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const receive = async () => {
    if (!orderId || handoffBusy) return;
    setHandoffBusy(true);
    try {
      await lab.receiveOrder(orderId, tx("receivedNote"));
      toast({ title: tx("orderReceived") });
      await load();
      onChanged();
    } catch (e: unknown) {
      toast({ title: tx("receiveError"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setHandoffBusy(false);
    }
  };

  const openDispute = async () => {
    if (!orderId || handoffBusy) return;
    const reason = window.prompt(tx("disputePrompt"));
    if (!reason?.trim()) return;
    setHandoffBusy(true);
    try {
      await lab.openDispute(orderId, reason.trim());
      toast({ title: tx("disputeSent") });
    } catch (e: unknown) {
      toast({ title: tx("openDisputeError"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setHandoffBusy(false);
    }
  };

  const resolveClarification = async (clarificationId: string, accepted: boolean) => {
    if (!orderId || !navigator.onLine) {
      toast({ title: tx("offlineError"), variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await lab.resolveClarification(orderId, clarificationId, { accepted });
      await load();
      onChanged();
      toast({ title: accepted ? tx("changesAccepted") : tx("proposalRejected") });
    } catch (e: unknown) {
      toast({
        title: tx("clarificationReplyError"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const timeline = order?.events ?? [];

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading || !order ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground text-cell">
            <Loader2 className="h-4 w-4 animate-spin" /> {tx("loading")}
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {order.work_type}
                {order.priority === "urgent" && <Badge variant="destructive">{tx("urgentBadge")}</Badge>}
                <Badge variant={STATUS_VARIANT[order.status] || "secondary"}>
                  {getLabStatusLabel(order.status, t)}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {order.order_number != null ? `${tx("order")} №${order.order_number}` : tx("order")} ·{" "}
                {tx("technician")}: {order.technician_name || "—"}
              </DialogDescription>
            </DialogHeader>

            {/* Fields */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
              <Field label={tx("patient")} value={order.patient_name} />
              <Field label={tx("material")} value={order.material} />
              <Field label={tx("tooth")} value={order.tooth} />
              <Field label={tx("shade")} value={order.shade} />
              <Field label={tx("deadline")} value={fmtDate(order.due_date, language)} />
              <Field label={tx("price")} value={fmtPrice(order.price, order.currency, language, t)} />
            </div>
            {order.notes && (
              <div className="pt-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  {tx("notes")}
                </div>
                <p className="mt-1 text-cell text-foreground whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
            <LabOrderFilesPanel
              orderId={order.id}
              readOnly={order.status === "cancelled" || order.status === "declined" || order.status === "delivered"}
            />
            {order.status === "declined" && order.declined_reason && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {tx("declinedByTechnician")}: {order.declined_reason}
              </div>
            )}

            {clarifications.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tx("clarificationTitle")}
                </div>
                <div className="space-y-2">
                  {clarifications.map((item) => (
                    <div key={item.id} className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                      <p className="whitespace-pre-wrap">{item.message}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        {item.proposed_due_at && <span>{tx("newDeadline")}: {fmtDate(item.proposed_due_at, language)}</span>}
                        {item.proposed_price != null && <span>{tx("newPrice")}: {fmtPrice(item.proposed_price, item.proposed_currency || order.currency, language, t)}</span>}
                      </div>
                      {item.status === "PENDING" ? (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Button size="sm" disabled={sending} onClick={() => void resolveClarification(item.id, true)}>
                            {tx("accept")}
                          </Button>
                          <Button size="sm" variant="outline" disabled={sending} onClick={() => void resolveClarification(item.id, false)}>
                            {tx("reject")}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs font-medium">
                          {item.status === "ACCEPTED" ? tx("accepted") : tx("rejected")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                {tx("timeline")}
              </div>
              <ol className="relative ml-1.5 border-l border-border">
                {timeline.length === 0 ? (
                  <li className="ml-4 text-sm text-muted-foreground">{tx("noEvents")}</li>
                ) : (
                  timeline.map((e, i) => (
                    <li key={i} className="ml-4 pb-3 last:pb-0 relative">
                      <span
                        className={cn(
                          "absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full",
                          e.to_status === "cancelled" || e.to_status === "declined"
                            ? "bg-destructive"
                            : "bg-primary",
                        )}
                      />
                      <div className="text-sm text-foreground">
                        {e.from_status ? `${getLabStatusLabel(e.from_status, t)} → ` : ""}
                        <span className="font-semibold">{getLabStatusLabel(e.to_status, t)}</span>
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {fmtDateTime(e.created_at, language)}
                        {e.actor_role ? ` · ${roleLabel(e.actor_role, tx)}` : ""}
                      </div>
                      {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                    </li>
                  ))
                )}
              </ol>
            </div>

            {/* Chat */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 inline-flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> {tx("chatTitle")}
              </div>
              <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    {tx("noMessages")}
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_role !== "technician";
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-lg px-3 py-1.5 text-sm",
                            mine ? "bg-primary text-primary-foreground" : "bg-card border border-border",
                          )}
                        >
                          <div className="text-[10px] opacity-70 mb-0.5">
                            {roleLabel(m.sender_role, tx)} · {fmtDateTime(m.created_at, language)}
                          </div>
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={threadEnd} />
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={tx("messagePlaceholder")}
                  disabled={sending}
                />
                <Button onClick={send} disabled={sending || !body.trim()} size="icon">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {order.status === "ready" && (
                <Button onClick={receive} disabled={handoffBusy}>
                  {handoffBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tx("confirmReceipt")}
                </Button>
              )}
              {(order.status === "ready" || order.status === "delivered") && (
                <Button variant="outline" onClick={openDispute} disabled={handoffBusy}>
                  {tx("openDispute")}
                </Button>
              )}
              {order.status === "new" ? (
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={cancel}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {tx("cancelOrder")}
                </Button>
              ) : (
                !TERMINAL.has(order.status) && (
                  <p className="text-xs text-muted-foreground">
                    {tx("cancelInChatHint")}
                  </p>
                )
              )}
              <Button variant="ghost" onClick={onClose} className="sm:ml-auto">
                {tx("close")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-0.5 text-base text-foreground">{value || "—"}</div>
    </div>
  );
}
