import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getPatientBillingHistory,
  type PatientInvoice,
  type PatientPayment,
} from "@/lib/patient-billing-api";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { cn } from "@/lib/utils";
import { AddPaymentNoteDialog } from "@/components/patient/AddPaymentNoteDialog";
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
import {
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Shield,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";

import type { Database } from "@/integrations/supabase/types";

type Invoice = PatientInvoice;
type Payment = PatientPayment;
type PaymentNote = Database["public"]["Tables"]["patient_payment_notes"]["Row"];

type TabKey = "my-notes" | "invoices" | "payments";

const PatientPaymentsPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentNotes, setPaymentNotes] = useState<PaymentNote[]>([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [myDebts, setMyDebts] = useState(0);
  const [myPayments, setMyPayments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [tab, setTab] = useState<TabKey>("my-notes");
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [dataUserId, setDataUserId] = useState<string | undefined>();
  const activeUserIdRef = useRef(user?.id);
  const loadSequenceRef = useRef(0);

  const fetchPaymentData = useCallback(async () => {
    const requestedUserId = user?.id;
    if (!requestedUserId) {
      setLoading(false);
      return true;
    }
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [billing, notesResult] = await Promise.all([
        getPatientBillingHistory(),
        supabase
          .from("patient_payment_notes")
          .select("*")
          .eq("patient_id", requestedUserId)
          .order("date", { ascending: false }),
      ]);
      if (
        sequence !== loadSequenceRef.current ||
        activeUserIdRef.current !== requestedUserId
      ) {
        return true;
      }
      if (notesResult.error) throw notesResult.error;

      setInvoices(billing.invoices);
      setPayments(billing.payments);
      setTotalDebt(
        billing.invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0),
      );
      setTotalPaid(
        billing.payments
          .filter((payment) => payment.status.toUpperCase() === "COMPLETED")
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      );

      const notes = notesResult.data ?? [];
      setPaymentNotes(notes);
      setMyDebts(
        notes
          .filter((note) => note.type === "debt" && !note.is_resolved)
          .reduce((sum, note) => sum + note.amount, 0),
      );
      setMyPayments(
        notes
          .filter((note) => note.type === "payment")
          .reduce((sum, note) => sum + note.amount, 0),
      );
      setDataUserId(requestedUserId);
      return true;
    } catch (error) {
      if (
        sequence !== loadSequenceRef.current ||
        activeUserIdRef.current !== requestedUserId
      ) {
        return true;
      }
      console.error("Error:", error);
      setLoadError(true);
      setDataUserId(requestedUserId);
      return false;
    } finally {
      if (
        sequence === loadSequenceRef.current &&
        activeUserIdRef.current === requestedUserId
      ) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    activeUserIdRef.current = user?.id;
    loadSequenceRef.current += 1;
    setInvoices([]);
    setPayments([]);
    setPaymentNotes([]);
    setTotalDebt(0);
    setTotalPaid(0);
    setMyDebts(0);
    setMyPayments(0);
    setLoadError(false);
    setShowAddDialog(false);
    setPendingNoteId(null);
    setDataUserId(undefined);
    if (user?.id) {
      setLoading(true);
      void fetchPaymentData();
    } else {
      setLoading(false);
    }
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [user?.id, fetchPaymentData]);

  const handleResolveDebt = async (noteId: string) => {
    if (pendingNoteId) return;
    const operationUserId = user?.id;
    setPendingNoteId(noteId);
    try {
      const { error } = await supabase
        .from("patient_payment_notes")
        .update({ is_resolved: true })
        .eq("id", noteId);
      if (error) throw error;
      if (activeUserIdRef.current !== operationUserId) return;
      const resolved = paymentNotes.find((note) => note.id === noteId);
      setPaymentNotes((current) =>
        current.map((note) => (note.id === noteId ? { ...note, is_resolved: true } : note)),
      );
      if (resolved?.type === "debt" && !resolved.is_resolved) {
        setMyDebts((current) => Math.max(0, current - resolved.amount));
      }
      toast.success(t("patientCabinet.debtPaid"));
      if (!(await fetchPaymentData())) toast.warning(t("common.error"));
    } catch {
      if (activeUserIdRef.current === operationUserId) {
        toast.error(t("patientCabinet.updateError"));
      }
    } finally {
      if (activeUserIdRef.current === operationUserId) setPendingNoteId(null);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (pendingNoteId) return;
    const operationUserId = user?.id;
    setPendingNoteId(noteId);
    try {
      const { error } = await supabase
        .from("patient_payment_notes")
        .delete()
        .eq("id", noteId);
      if (error) throw error;
      if (activeUserIdRef.current !== operationUserId) return;
      const deleted = paymentNotes.find((note) => note.id === noteId);
      setPaymentNotes((current) => current.filter((note) => note.id !== noteId));
      if (deleted?.type === "debt" && !deleted.is_resolved) {
        setMyDebts((current) => Math.max(0, current - deleted.amount));
      } else if (deleted?.type === "payment") {
        setMyPayments((current) => Math.max(0, current - deleted.amount));
      }
      toast.success(t("patientCabinet.recordDeleted"));
      if (!(await fetchPaymentData())) toast.warning(t("common.error"));
    } catch {
      if (activeUserIdRef.current === operationUserId) {
        toast.error(t("patientCabinet.deleteError"));
      }
    } finally {
      if (activeUserIdRef.current === operationUserId) setPendingNoteId(null);
    }
  };

  if (loading || (Boolean(user?.id) && dataUserId !== user?.id)) {
    return (
      <PatientLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--brand))]" aria-hidden="true" />
            <span>{t("common.loading")}</span>
          </div>
        </div>
      </PatientLayout>
    );
  }

  const unresolvedDebts = paymentNotes.filter(
    (n) => n.type === "debt" && !n.is_resolved
  );
  const resolvedDebts = paymentNotes.filter(
    (n) => n.type === "debt" && n.is_resolved
  );
  const myPaymentNotes = paymentNotes.filter((n) => n.type === "payment");
  const totalDue = totalDebt + myDebts;

  return (
    <PatientLayout>
      <div className="mx-auto max-w-[1100px] p-4 sm:p-6">
        {loadError && (
          <div
            className="mb-4 flex flex-col gap-3 rounded-xl border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center"
            role="alert"
          >
            <span className="min-w-0 flex-1">{t("common.error")}</span>
            <button
              type="button"
              className="min-h-11 rounded-[10px] border border-border bg-card px-4 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void fetchPaymentData()}
            >
              {t("common.retry")}
            </button>
          </div>
        )}
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[12.5px] text-muted-foreground">{t("patientCabinet.payments")}</div>
            <h2 className="font-heading text-[24px] font-bold tracking-tight text-foreground">
              {t("patientCabinet.billsAndPayments")}
            </h2>
          </div>
          <button
            onClick={() => setShowAddDialog(true)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {t("patientCabinet.addRecord")}
          </button>
        </div>

        {/* KPI tiles */}
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard
            label={t("patientCabinet.kpiToPay")}
            value={formatPrice(totalDue)}
            accent="rose"
            cta={
              totalDue > 0
                ? {
                    label: t("patientCabinet.payOnline"),
                    icon: <CreditCard className="h-3.5 w-3.5" />,
                  }
                : undefined
            }
          />
          <KpiCard
            label={t("patientCabinet.kpiTotalPaid")}
            value={formatPrice(totalPaid + myPayments)}
            hint={`${payments.length + myPaymentNotes.length} ${t("patientCabinet.records")}`}
          />
          <KpiCard
            label={t("patientCabinet.kpiClinicBills")}
            value={formatPrice(totalDebt)}
            hint={`${invoices.length} ${t("patientCabinet.bills")}`}
          />
        </div>

        {/* Online payment section */}
        {totalDue > 0 && (
          <div className="mb-5 overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div
              className="px-5 py-4"
              style={{
                background:
                  "linear-gradient(180deg, hsl(var(--brand-50)), hsl(var(--card)))",
              }}
            >
              <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[hsl(var(--brand-700))]" />
                    <div className="font-heading text-[14px] font-semibold text-foreground">
                      {t("patientCabinet.quickOnlinePayment")}
                    </div>
                  </div>
                  <div className="mt-1 max-w-md text-[12.5px] text-muted-foreground">
                    {t("patientCabinet.instantTransactions")}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3 text-[hsl(var(--brand-700))]" />
                    {t("patientCabinet.secureConnection")}
                  </div>
                </div>
                {/* Онлайн-оплата (Payme/Click) недоступна на пилоте — кнопки честно
                    задизейблены, чтобы не имитировать рабочий платёжный поток. */}
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled
                      title="Онлайн-оплата скоро"
                      className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-bold text-primary-foreground opacity-50 shadow-sm"
                    >
                      <span>💳</span> Payme
                    </button>
                    <button
                      disabled
                      title="Онлайн-оплата скоро"
                      className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-[10px] bg-[hsl(var(--accent))] px-4 py-2 text-[13px] font-bold text-accent-foreground opacity-50 shadow-sm"
                    >
                      <span>💎</span> Click
                    </button>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">Онлайн-оплата скоро</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex max-w-full items-center gap-1 overflow-x-auto rounded-[10px] bg-muted p-1">
          {(
            [
              { k: "my-notes" as const, label: `${t("patientCabinet.tabMyNotes")} · ${paymentNotes.length}` },
              { k: "invoices" as const, label: `${t("patientCabinet.tabInvoices")} · ${invoices.length}` },
              { k: "payments" as const, label: `${t("patientCabinet.tabPayments")} · ${payments.length}` },
            ]
          ).map((tt) => (
            <button
              key={tt.k}
              type="button"
              data-testid={`patient-payments-tab-${tt.k}`}
              aria-pressed={tab === tt.k}
              onClick={() => setTab(tt.k)}
              className={cn(
                "min-h-11 shrink-0 rounded-[7px] px-3.5 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === tt.k
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tt.label}
            </button>
          ))}
        </div>

        {tab === "my-notes" && (
          <div className="space-y-5">
            {unresolvedDebts.length > 0 && (
              <Section
                icon={<Clock className="h-3.5 w-3.5" />}
                title={t("patientCabinet.activeDebts")}
              >
                {unresolvedDebts.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    tone="amber"
                    onResolve={() => handleResolveDebt(note.id)}
                    onDelete={() => handleDeleteNote(note.id)}
                    pending={pendingNoteId === note.id}
                  />
                ))}
              </Section>
            )}

            {myPaymentNotes.length > 0 && (
              <Section
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                title={t("patientCabinet.myPayments")}
              >
                {myPaymentNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    tone="emerald"
                    onDelete={() => handleDeleteNote(note.id)}
                    pending={pendingNoteId === note.id}
                  />
                ))}
              </Section>
            )}

            {resolvedDebts.length > 0 && (
              <Section
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                title={t("patientCabinet.paidDebts")}
              >
                {resolvedDebts.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    tone="muted"
                    resolved
                  />
                ))}
              </Section>
            )}

            {paymentNotes.length === 0 && (
              <EmptyState
                icon={<Receipt className="h-10 w-10 text-muted-foreground" />}
                title={t("patientCabinet.noRecords")}
                subtitle={t("patientCabinet.noRecordsDesc")}
                ctaLabel={t("patientCabinet.addRecord")}
                onCta={() => setShowAddDialog(true)}
              />
            )}
          </div>
        )}

        {tab === "invoices" && (
          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            {invoices.length === 0 ? (
              <EmptyInline
                icon={<FileText className="h-10 w-10 text-muted-foreground" />}
                title={t("patientCabinet.noBills")}
                subtitle={t("patientCabinet.noBillsDesc")}
              />
            ) : (
              <>
                <div className="hidden grid-cols-[auto_1fr_140px_auto] items-center gap-4 border-b border-border bg-muted/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                  <div>{t("patientCabinet.colStatus")}</div>
                  <div>{t("patientCabinet.colInvoice")}</div>
                  <div className="text-right">{t("patientCabinet.colAmount")}</div>
                  <div />
                </div>
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    data-testid="patient-invoice-row"
                    data-invoice-id={inv.id}
                    data-invoice-status={inv.status.toLowerCase()}
                    className="grid grid-cols-1 items-center gap-3 border-b border-border px-4 py-4 last:border-b-0 hover:bg-muted/60 sm:px-5 md:grid-cols-[auto_1fr_140px_auto] md:gap-4"
                  >
                    <div>
                      {inv.status.toUpperCase() === "PAID" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--success-green)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--success-green))] ring-1 ring-[hsl(var(--success-green)/0.3)]">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          {t("patientCabinet.paid")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--warning-amber)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--warning-amber))] ring-1 ring-[hsl(var(--warning-amber)/0.3)]">
                          <Clock className="h-2.5 w-2.5" />
                          {t("patientCabinet.pendingShort")}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium text-foreground">
                        #{inv.invoice_number || inv.id.slice(0, 8)}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {format(new Date(inv.created_at ?? 0), "d MMMM yyyy", {
                          locale: ru,
                        })}
                      </div>
                    </div>
                    <div className="font-heading text-[14px] font-bold tabular-nums md:text-right">
                      {formatPrice(inv.total)}
                    </div>
                    {/* "Оплатить" и "PDF" не реализованы на пилоте — честно
                        задизейблены, а не имитируют успешную оплату/скачивание. */}
                    <div className="flex gap-2 md:justify-end">
                      {inv.status.toUpperCase() !== "PAID" && (
                        <button
                          disabled
                          title="Онлайн-оплата скоро"
                          className="inline-flex min-h-11 cursor-not-allowed items-center gap-1 rounded-[10px] bg-[hsl(var(--brand))] px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-50"
                        >
                          {t("patientCabinet.payNow")}
                        </button>
                      )}
                      <button
                        disabled
                        title="Скачивание счёта скоро"
                        className="inline-flex min-h-11 cursor-not-allowed items-center gap-1 rounded-[10px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-60"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            {payments.length === 0 ? (
              <EmptyInline
                icon={<CreditCard className="h-10 w-10 text-muted-foreground" />}
                title={t("patientCabinet.noPayments")}
                subtitle={t("patientCabinet.noPaymentsDesc")}
              />
            ) : (
              <>
                <div className="hidden grid-cols-[auto_1fr_160px_140px] items-center gap-4 border-b border-border bg-muted/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                  <div />
                  <div>{t("patientCabinet.colDate")}</div>
                  <div>{t("patientCabinet.colMethod")}</div>
                  <div className="text-right">{t("patientCabinet.colAmount")}</div>
                </div>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-1 items-center gap-3 border-b border-border px-4 py-4 last:border-b-0 hover:bg-muted/60 sm:px-5 md:grid-cols-[auto_1fr_160px_140px] md:gap-4"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--success-green)/0.1)] text-[hsl(var(--success-green))]">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="text-[13px] tabular-nums text-foreground">
                      {format(new Date(p.created_at ?? 0), "d MMMM yyyy", {
                        locale: ru,
                      })}
                    </div>
                    <div className="text-[12.5px] text-muted-foreground">
                      {p.method || t("patientCabinet.cash")}
                    </div>
                    <div className="font-heading text-[14px] font-bold tabular-nums md:text-right">
                      {formatPrice(p.amount)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <AddPaymentNoteDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchPaymentData}
      />
    </PatientLayout>
  );
};

// ───────────────────────── KpiCard ─────────────────────────
const KpiCard = ({
  label,
  value,
  hint,
  accent,
  cta,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "rose";
  cta?: { label: string; icon?: React.ReactNode };
}) => (
  <div className="rounded-[14px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
    <div
      className={cn(
        "mt-1 font-heading text-[24px] font-bold tabular-nums",
        accent === "rose" ? "text-destructive" : "text-foreground"
      )}
    >
      {value}
    </div>
    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    {/* Онлайн-оплата недоступна на пилоте — CTA честно задизейблен. */}
    {cta && (
      <button
        disabled
        title="Онлайн-оплата скоро"
        className="mt-3 inline-flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground opacity-50"
      >
        {cta.icon}
        {cta.label}
      </button>
    )}
  </div>
);

// ───────────────────────── Section ─────────────────────────
const Section = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {title}
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

// ───────────────────────── NoteCard ─────────────────────────
const TONE_MAP = {
  amber: {
    border: "border-[hsl(var(--warning-amber)/0.3)]",
    bg: "bg-[hsl(var(--warning-amber)/0.1)]",
    iconBg: "bg-[hsl(var(--warning-amber)/0.15)] text-[hsl(var(--warning-amber))]",
  },
  emerald: {
    border: "border-[hsl(var(--success-green)/0.3)]",
    bg: "bg-[hsl(var(--success-green)/0.1)]",
    iconBg: "bg-[hsl(var(--success-green)/0.15)] text-[hsl(var(--success-green))]",
  },
  muted: {
    border: "border-border",
    bg: "bg-muted/60",
    iconBg: "bg-muted text-muted-foreground",
  },
} as const;

const NoteCard = ({
  note,
  tone,
  resolved,
  onResolve,
  onDelete,
  pending = false,
}: {
  note: PaymentNote;
  tone: keyof typeof TONE_MAP;
  resolved?: boolean;
  onResolve?: () => void;
  onDelete?: () => void;
  pending?: boolean;
}) => {
  const { t: tt } = useLanguage();
  const t = TONE_MAP[tone];
  return (
    <div
      className={cn(
        "flex flex-col items-stretch justify-between gap-4 rounded-[14px] border p-4 sm:flex-row sm:items-start",
        t.border,
        t.bg,
        resolved && "opacity-80"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px]", t.iconBg)}>
          {note.type === "debt" ? (
            <Receipt className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "font-heading text-[16px] font-bold tabular-nums",
              resolved ? "text-muted-foreground line-through" : "text-foreground"
            )}
          >
            {formatPrice(note.amount)}
          </div>
          {note.clinic_name && (
            <div className="text-[12.5px] text-foreground">
              {note.clinic_name}
            </div>
          )}
          {note.description && (
            <div className="text-xs text-muted-foreground">{note.description}</div>
          )}
          <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {format(new Date(note.date), "d MMMM yyyy", { locale: ru })}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {resolved ? (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {tt("patientCabinet.paidLabel")}
          </span>
        ) : (
          <>
            {onResolve && (
              <button
                type="button"
                onClick={onResolve}
                disabled={pending}
                className="inline-flex min-h-11 items-center gap-1 rounded-[10px] bg-[hsl(var(--success-green))] px-3 py-1.5 text-xs font-medium text-card hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Check className="h-3.5 w-3.5" />
                {tt("patientCabinet.payOff")}
              </button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={pending}
                    className="grid h-11 w-11 place-items-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={tt("common.delete")}
                    aria-label={tt("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{tt("common.delete")}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {formatPrice(note.amount)}
                      {note.clinic_name ? ` · ${note.clinic_name}` : ""}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tt("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onDelete}
                    >
                      {tt("common.delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ───────────────────────── Empty states ─────────────────────────
const EmptyState = ({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
}) => (
  <div className="rounded-[14px] border border-dashed border-border bg-card px-6 py-10 text-center">
    <div className="mx-auto mb-3 grid h-10 w-10 place-items-center">{icon}</div>
    <div className="font-heading text-[16px] font-semibold text-foreground">
      {title}
    </div>
    <div className="mt-1 text-[13px] text-muted-foreground">{subtitle}</div>
    {ctaLabel && onCta && (
      <button
        onClick={onCta}
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" />
        {ctaLabel}
      </button>
    )}
  </div>
);

const EmptyInline = ({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) => (
  <div className="px-6 py-10 text-center">
    <div className="mx-auto mb-3 grid h-10 w-10 place-items-center">{icon}</div>
    <div className="font-heading text-[16px] font-semibold text-foreground">
      {title}
    </div>
    <div className="mt-1 text-[13px] text-muted-foreground">{subtitle}</div>
  </div>
);

export default PatientPaymentsPage;
