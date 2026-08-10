import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ChevronRight,
  Clock,
  Download,
  FlaskConical,
  Loader2,
  Plus,
  Search,
  Stethoscope,
  Wrench,
} from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { DesignCard, DesignBadge, SectionTitle } from "@/components/design";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { lab, type LabCustomer, type LabOrder, type LabOrderStatus } from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearLabDraft,
  loadLabDraft,
  loadOrCreateLabRequestId,
  saveLabDraft,
} from "@/lib/lab-drafts";

// ── Status model ────────────────────────────────────────────────────────────
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

// Forward flow used for progress bars (queued → … → delivered = 7 steps).
const FLOW = ["queued", "model", "wax", "milling", "frame", "glaze", "ready", "delivered"];
const IN_WORK = new Set(["model", "wax", "milling", "frame", "glaze", "ready"]);

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

function progressFor(status: string): number {
  const idx = FLOW.indexOf(status);
  if (idx < 0) return 0;
  return Math.round((idx / 7) * 100);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Relative day hint for a YYYY-MM-DD due date.
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

function formatDue(due: string | null): string {
  if (!due) return "—";
  const d = new Date(due.slice(0, 10) + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// Group digits with spaces for display: "5000000" -> "5 000 000".
const groupDigits = (s: string): string =>
  (s || "").replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

interface NewOrderForm {
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

export default function TechnicianOrders() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [active, setActive] = useState<LabOrder[]>([]);
  const [allOrders, setAllOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewOrderForm>(EMPTY_FORM);
  const [workTypeTouched, setWorkTypeTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Customer (заказчик) for a self-order: registered Prodent doctor/clinic OR external.
  const [customerMode, setCustomerMode] = useState<"external" | "registered">("external");
  const [custQuery, setCustQuery] = useState("");
  const [custResults, setCustResults] = useState<LabCustomer[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [picked, setPicked] = useState<LabCustomer | null>(null);
  const [extName, setExtName] = useState("");
  const [extPhone, setExtPhone] = useState("");
  const [extClinic, setExtClinic] = useState("");

  // Filters over the active queue.
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<"all" | "urgent">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Single scoped fetch off the lab API; derive the active queue client-side.
      const all = await lab.listOrders();
      const TERMINAL = new Set<LabOrderStatus>(["delivered", "cancelled", "declined"]);
      const activeList = all
        .filter((o) => !TERMINAL.has(o.status))
        .sort((a, b) => {
          const ad = a.due_date ? String(a.due_date).slice(0, 10) : "9999-99-99";
          const bd = b.due_date ? String(b.due_date).slice(0, 10) : "9999-99-99";
          return ad < bd ? -1 : ad > bd ? 1 : 0;
        });

      setActive(activeList);
      setAllOrders(all);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Не удалось загрузить заказы"));
      setActive([]);
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (dialogOpen) setForm(loadLabDraft("technician-new-order", user?.id, EMPTY_FORM));
  }, [dialogOpen, user?.id]);

  useEffect(() => {
    if (dialogOpen) saveLabDraft("technician-new-order", user?.id, form);
  }, [dialogOpen, form, user?.id]);

  // Debounced customer directory search (registered mode).
  useEffect(() => {
    if (customerMode !== "registered") return;
    const term = custQuery.trim();
    if (term.length < 2) {
      setCustResults([]);
      return;
    }
    let active = true;
    setCustLoading(true);
    const t = setTimeout(() => {
      lab
        .searchCustomers(term)
        .then((r) => active && setCustResults(r))
        .catch(() => active && setCustResults([]))
        .finally(() => active && setCustLoading(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [custQuery, customerMode]);

  const resetCustomer = () => {
    setCustomerMode("external");
    setCustQuery("");
    setCustResults([]);
    setPicked(null);
    setExtName("");
    setExtPhone("");
    setExtClinic("");
  };

  const kpis = useMemo(() => {
    const today = todayIso();
    const queued = allOrders.filter((o) => o.status === "queued").length;
    const inWork = allOrders.filter((o) => IN_WORK.has(o.status)).length;
    const dueToday = allOrders.filter(
      (o) =>
        o.due_date &&
        String(o.due_date).slice(0, 10) === today &&
        o.status !== "delivered" &&
        o.status !== "cancelled",
    ).length;
    const cutoff = Date.now() - 30 * 86_400_000;
    const done30 = allOrders.filter((o) => {
      if (o.status !== "delivered") return false;
      const ts = o.updated_at ? new Date(o.updated_at).getTime() : NaN;
      return Number.isNaN(ts) ? true : ts >= cutoff;
    }).length;
    return { queued, inWork, dueToday, done30 };
  }, [allOrders]);

  // Active queue narrowed by search + priority.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter((o) => {
      if (priority === "urgent" && o.priority !== "urgent") return false;
      if (!q) return true;
      return [o.work_type, o.patient_name, o.material, o.order_number != null ? `№${o.order_number}` : "", String(o.order_number)]
        .filter(Boolean)
        .some((f: string) => String(f).toLowerCase().includes(q));
    });
  }, [active, query, priority]);

  const exportCsv = () => {
    if (!visible.length) return;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["№", "Пациент", "Работа", "Материал", "Этап", "Приоритет", "Срок", "Цена"].map(esc).join(",");
    const rows = visible.map((o) =>
      [o.order_number, o.patient_name, o.work_type, o.material, STATUS_LABELS[o.status] || o.status,
       o.priority === "urgent" ? "Срочный" : "Обычный", o.due_date, o.price]
        .map(esc)
        .join(","),
    );
    const blob = new Blob(["﻿" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lab-orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const setField = (k: keyof NewOrderForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (loading || error) return;
    if (!form.work_type.trim()) {
      setWorkTypeTouched(true);
      toast({
        title: "Укажите тип работы",
        description: "Поле «Тип работы» обязательно.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      // Customer: a registered Prodent doctor/clinic (by id) or an external one.
      const customer =
        customerMode === "registered" && picked
          ? picked.type === "doctor"
            ? { doctor_id: picked.id }
            : { clinic_id: picked.id }
          : {
              external_customer_name: extName.trim() || null,
              external_customer_phone: extPhone.trim() || null,
              external_customer_clinic: extClinic.trim() || null,
            };

      // Self-order: the server assigns it to the technician and starts it at
      // "queued" — technician_id/status are server-controlled.
      const clientRequestId = loadOrCreateLabRequestId(
        "technician-new-order",
        user?.id,
      );
      await lab.createOrder({
        client_request_id: clientRequestId,
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
        ...customer,
      });

      toast({ title: "Заказ создан", description: "Новый заказ добавлен в очередь." });
      clearLabDraft("technician-new-order", user?.id);
      clearLabDraft("technician-new-order-request-id", user?.id);
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      resetCustomer();
      await load();
    } catch (error: unknown) {
      toast({
        title: "Не удалось создать заказ",
        description: getErrorMessage(error, "Попробуйте ещё раз."),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const dueTodaySubtitle = kpis.dueToday > 0 ? `${kpis.dueToday} со сроком сегодня` : "сроки под контролем";

  return (
    <TechnicianLayout title="Заказы" subtitle={`Очередь · ${active.length} заказов · ${dueTodaySubtitle}`}>
      <div className="mx-auto max-w-[1320px] p-4 sm:p-6 lg:p-8">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { l: "В очереди", v: kpis.queued, sub: "новые поступления" },
            { l: "В работе", v: kpis.inWork, sub: "на этапах CAD/CAM" },
            { l: "Срок сегодня", v: kpis.dueToday, tone: "text-[hsl(var(--warning-amber))]", sub: "не упустить" },
            {
              l: "Завершено · 30д",
              v: kpis.done30,
              tone: "text-[hsl(var(--brand-700))]",
              sub: "выдано клиникам",
            },
          ].map((s) => (
            <DesignCard key={s.l} pad="p-4">
              <div className="text-xs font-medium text-muted-foreground">{s.l}</div>
              <div className={cn("mt-2 text-[24px] font-bold tabular-nums font-display leading-none", s.tone)}>
                {loading ? "—" : s.v}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{s.sub}</div>
            </DesignCard>
          ))}
        </div>

        <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle subtitle="по приоритету и сроку">Активные заказы</SectionTitle>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={loading || !!error}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            style={{
              background: "hsl(var(--brand))",
              boxShadow: "0 1px 2px rgba(13,148,136,0.25), 0 4px 12px -2px rgba(13,148,136,0.35)",
            }}
          >
            <Plus className="w-4 h-4" /> Новый заказ
          </button>
        </div>

        {/* Filters + export */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: работа, пациент, материал, №"
              aria-label="Поиск заказов"
              className="pl-9"
            />
          </div>
          <div className="inline-flex w-fit items-center gap-1 rounded-[10px] bg-muted p-1" role="group" aria-label="Фильтр срочности">
            {(["all", "urgent"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPriority(key)}
                aria-pressed={priority === key}
                className={cn(
                  "min-h-11 rounded-[8px] px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  priority === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                {key === "all" ? "Все" : "Срочные"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visible.length} className="min-h-11 shrink-0 gap-2">
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>

        <DesignCard pad="p-0">
          <div className="hidden grid-cols-[80px_1fr_1fr_140px_140px_44px] border-b border-border bg-muted/40 px-5 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground md:grid">
            <div>№</div>
            <div>Пациент / врач</div>
            <div>Работа</div>
            <div>Этап</div>
            <div>Срок</div>
            <div></div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13.5px] text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Загрузка заказов…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
              <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="text-[13.5px] font-medium text-foreground">Не удалось загрузить заказы</div>
              <div className="max-w-sm text-xs text-muted-foreground">{error}</div>
              <Button variant="outline" size="sm" onClick={load} className="min-h-11">
                Повторить
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="w-11 h-11 rounded-[12px] bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))]">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="text-[14px] font-semibold text-foreground">
                {active.length === 0 ? "Активных заказов нет" : "Ничего не найдено"}
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                {active.length === 0 ? "Очередь пуста — создайте новый заказ." : "Измените поиск или фильтр."}
              </div>
            </div>
          ) : (
            visible.map((o) => {
              const hint = dueHint(o.due_date);
              const progress = progressFor(o.status);
              return (
                <Link
                  key={o.id}
                  to={`/technician/order?id=${o.id}`}
                  className="grid min-h-11 grid-cols-1 items-center gap-2 border-b border-border px-4 py-4 text-[13px] last:border-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 md:grid-cols-[80px_1fr_1fr_140px_140px_44px] md:gap-0"
                >
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">
                    {o.order_number != null ? `№${o.order_number}` : String(o.id).slice(0, 6)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate font-medium text-foreground">
                      {o.patient_name || "Без пациента"}
                      {o.priority === "urgent" && (
                        <DesignBadge tone="rose">Срочно</DesignBadge>
                      )}
                    </div>
                    {(o.external_customer_name || o.doctor_name || o.clinic_name) && (
                      <div className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground">
                        <Stethoscope className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {o.external_customer_name || o.doctor_name || o.clinic_name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">{o.work_type}</div>
                    {o.material && (
                      <div className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <FlaskConical className="w-3 h-3 shrink-0" /> {o.material}
                      </div>
                    )}
                  </div>
                  <div>
                    <DesignBadge tone={STATUS_TONE[o.status] ?? "neutral"}>
                      <Wrench className="w-3 h-3" /> {STATUS_LABELS[o.status] ?? o.status}
                    </DesignBadge>
                    <div className="mt-1.5 h-1 w-[100px] overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${progress}%`, background: "hsl(var(--brand))" }}
                      />
                    </div>
                  </div>
                  <div className="text-[12.5px]">
                    <div
                      className={cn(
                        "font-semibold tabular-nums",
                        hint.tone === "danger" && "text-destructive",
                        hint.tone === "warn" && "text-[hsl(var(--warning-amber))]",
                        hint.tone === "muted" && "text-foreground",
                      )}
                    >
                      <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                      {formatDue(o.due_date)}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{hint.label}</div>
                  </div>
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" aria-hidden="true" />
                </Link>
              );
            })
          )}
        </DesignCard>
      </div>

      {/* New order dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (submitting) return;
          setDialogOpen(o);
          if (!o) {
            setForm(EMPTY_FORM);
            setWorkTypeTouched(false);
            resetCustomer();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый заказ</DialogTitle>
            <DialogDescription>Заполните данные — заказ попадёт в очередь.</DialogDescription>
          </DialogHeader>

          {/* Заказчик — registered Prodent doctor/clinic OR an external (offline) one */}
          <div className="mb-1 space-y-2 border-b pb-3">
            <Label>Заказчик</Label>
            <div className="inline-flex rounded-[10px] bg-muted p-1" role="group" aria-label="Тип заказчика">
              {(["external", "registered"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCustomerMode(m)}
                  aria-pressed={customerMode === m}
                  className={cn(
                    "min-h-11 rounded-[8px] px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    customerMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  {m === "external" ? "Внешний" : "Из Prodent"}
                </button>
              ))}
            </div>

            {customerMode === "registered" ? (
              picked ? (
                <div className="flex items-center justify-between gap-2 rounded-[10px] border border-border bg-muted/50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">{picked.name || "Без имени"}</div>
                    <div className="text-xs text-muted-foreground">
                      {picked.type === "doctor" ? "врач" : "клиника"}
                      {picked.phone ? ` · ${picked.phone}` : ""}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setPicked(null); setCustQuery(""); }} className="min-h-11">
                    Изменить
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={custQuery}
                    onChange={(e) => setCustQuery(e.target.value)}
                    placeholder="Поиск врача или клиники в Prodent"
                    className="pl-9"
                  />
                  {custQuery.trim().length >= 2 && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[10px] border border-border bg-card shadow-lg">
                      {custLoading ? (
                        <div className="px-3 py-2 text-[13px] text-muted-foreground" role="status">Поиск…</div>
                      ) : custResults.length === 0 ? (
                        <div className="px-3 py-2 text-[13px] text-muted-foreground">Ничего не найдено</div>
                      ) : (
                        custResults.map((r) => (
                          <button
                            key={`${r.type}-${r.id}`}
                            type="button"
                            onClick={() => { setPicked(r); setCustResults([]); }}
                            className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          >
                            <span className="min-w-0 truncate text-[13px] text-foreground">{r.name || "Без имени"}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{r.type === "doctor" ? "врач" : "клиника"}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Имя и фамилия" />
                <Input value={extPhone} onChange={(e) => setExtPhone(e.target.value)} placeholder="Телефон" />
                <Input
                  value={extClinic}
                  onChange={(e) => setExtClinic(e.target.value)}
                  placeholder="Клиника (необязательно)"
                  className="sm:col-span-2"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="work_type">
                Тип работы <span className="text-destructive">*</span>
              </Label>
              <Input
                id="work_type"
                required
                value={form.work_type}
                onChange={(e) => setField("work_type", e.target.value)}
                onBlur={() => setWorkTypeTouched(true)}
                aria-invalid={workTypeTouched && !form.work_type.trim()}
                aria-describedby={workTypeTouched && !form.work_type.trim() ? "work-type-error" : undefined}
                placeholder="Циркониевая коронка 36"
              />
              {workTypeTouched && !form.work_type.trim() && (
                <p id="work-type-error" className="text-xs text-destructive" role="alert">
                  Укажите тип работы
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material">Материал</Label>
              <Input
                id="material"
                value={form.material}
                onChange={(e) => setField("material", e.target.value)}
                placeholder="IPS e.max ZirCAD MT"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patient_name">Пациент</Label>
              <Input
                id="patient_name"
                value={form.patient_name}
                onChange={(e) => setField("patient_name", e.target.value)}
                placeholder="Юсупов А."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tooth">Зуб</Label>
              <Input
                id="tooth"
                value={form.tooth}
                onChange={(e) => setField("tooth", e.target.value)}
                placeholder="36"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shade">Оттенок</Label>
              <Input
                id="shade"
                value={form.shade}
                onChange={(e) => setField("shade", e.target.value)}
                placeholder="A2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Приоритет</Label>
              <select
                id="priority"
                value={form.priority}
                onChange={(e) => setField("priority", e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="normal">Обычный</option>
                <option value="urgent">Срочный</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Срок</Label>
              <Input
                id="due_date"
                type="date"
                value={form.due_date}
                onChange={(e) => setField("due_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="price">Ориентировочная цена</Label>
              <div className="flex gap-2">
                <Input
                  id="price"
                  type="text"
                  inputMode="numeric"
                  value={groupDigits(form.price)}
                  onChange={(e) => setField("price", e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="flex-1"
                />
                <select
                  value={form.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  className="flex h-11 w-32 shrink-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Валюта"
                >
                  <option value="UZS">сум (UZS)</option>
                  <option value="USD">доллар ($)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Заметки</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Особенности прикуса, пожелания врача…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || loading || !!error || !form.work_type.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Создать заказ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TechnicianLayout>
  );
}
