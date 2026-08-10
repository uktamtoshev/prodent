import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, FilePlus2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  clearPersistentClientRequestId,
  createClinicInvoice,
  createClinicPayment,
  getPersistentClientRequestId,
  listClinicDebts,
  listClinicInvoices,
  listReportOperations,
  refundClinicPayment,
  searchClinicPatients,
} from "@/lib/crm-operations-api";
import { formatPrice } from "@/lib/utils";
import {
  isFinanceScopeActive,
  setFinanceScopeDuringRender,
  type FinanceScope,
} from "./finance-scope";

type Focus = "invoices" | "payments" | "debts";
type Row = Record<string, unknown>;
type PendingSync = {
  kind: "invoice" | "payment" | "refund";
  action: string;
  actor: string;
  clinicId: string;
};

export function ClinicFinanceOperations({ focus }: { focus: Focus }) {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Hand the debt row straight to the payment form: select the invoice, prefill
   * the amount with what is still owed, and switch the tab. Also written into
   * the URL, so the state survives a reload and can be shared.
   */
  const startPaymentFor = useCallback(
    (invoiceKey: string, balanceDue: number) => {
      setInvoiceId(invoiceKey);
      setPaymentAmount(balanceDue > 0 ? String(balanceDue) : "");
      const next = new URLSearchParams(searchParams);
      next.set("tab", "payments");
      next.set("invoice", invoiceKey);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  // Deep link support: /crm/finance?tab=payments&invoice=<id> preselects the
  // invoice, so the row -> payment hand-off survives a reload.
  const requestedInvoice = searchParams.get("invoice");
  useEffect(() => {
    if (requestedInvoice) setInvoiceId(requestedInvoice);
  }, [requestedInvoice]);

  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const uz = language === "uz";
  const clinicId = currentClinic?.id;
  const actor = user?.id ?? "anonymous";
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentId, setPaymentId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [invoiceAttempted, setInvoiceAttempted] = useState(false);
  const [paymentAttempted, setPaymentAttempted] = useState(false);
  const [refundAttempted, setRefundAttempted] = useState(false);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [pendingSync, setPendingSync] = useState<PendingSync | null>(null);
  const [syncRetrying, setSyncRetrying] = useState(false);
  const activeScopeRef = useRef<FinanceScope>({ actor, clinicId });
  setFinanceScopeDuringRender(activeScopeRef, { actor, clinicId });

  useEffect(() => {
    setPatientSearch("");
    setPatientId("");
    setSubtotal("");
    setInvoiceId("");
    setPaymentAmount("");
    setPaymentMethod("CASH");
    setPaymentId("");
    setRefundAmount("");
    setRefundReason("");
    setInvoiceAttempted(false);
    setPaymentAttempted(false);
    setRefundAttempted(false);
    setRefundConfirmOpen(false);
    setPendingSync(null);
    setSyncRetrying(false);
  }, [actor, clinicId]);

  const invoices = useQuery({
    queryKey: ["s7-invoices", clinicId, user?.id],
    queryFn: () => listClinicInvoices(clinicId!),
    enabled: !!clinicId,
  });
  const debts = useQuery({
    queryKey: ["s7-debts", clinicId, user?.id],
    queryFn: () => listClinicDebts(clinicId!),
    enabled: !!clinicId,
  });
  const patients = useQuery({
    queryKey: ["s7-finance-patients", clinicId, user?.id, patientSearch],
    queryFn: () => searchClinicPatients(clinicId!, patientSearch),
    enabled: !!clinicId && patientSearch.trim().length >= 2,
  });
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 2, 1).toLocaleDateString("en-CA");
  const to = today.toLocaleDateString("en-CA");
  const operations = useQuery({
    queryKey: ["s7-finance-operations", clinicId, user?.id, from, to],
    queryFn: () => listReportOperations(clinicId!, { from, to, size: 200 }),
    enabled: !!clinicId && focus === "payments",
  });

  const invoiceRows = (invoices.data ?? []) as Row[];
  const debtRows = (debts.data ?? []) as Row[];
  const paymentRows = useMemo(
    () =>
      (operations.data ?? []).filter((row) =>
        ["PAYMENT", "PAYMENT_RECORDED"].includes(
          String(row.event_type ?? row.operation_type ?? row.type ?? "").toUpperCase(),
        ),
      ),
    [operations.data],
  );
  const selectedInvoice = invoiceRows.find((row) => String(row.id) === invoiceId);
  const selectedPayment = paymentRows.find((row) => String(row.payment_id) === paymentId);
  const invoiceAmount = Number(subtotal);
  const paymentValue = Number(paymentAmount);
  const refundValue = Number(refundAmount);
  const invoiceValid = Boolean(patientId) && Number.isFinite(invoiceAmount) && invoiceAmount > 0;
  const paymentValid =
    Boolean(selectedInvoice) &&
    Number.isFinite(paymentValue) &&
    paymentValue > 0 &&
    paymentValue <= Number(selectedInvoice?.balance_due ?? 0);
  const refundValid =
    Boolean(selectedPayment) &&
    Boolean(refundReason.trim()) &&
    Number.isFinite(refundValue) &&
    refundValue > 0 &&
    refundValue <= Number(selectedPayment?.amount ?? 0);

  const refresh = async (scopeClinicId: string, scopeActor: string) => {
    await Promise.all([
      queryClient.refetchQueries(
        { queryKey: ["s7-invoices", scopeClinicId, scopeActor], type: "active" },
        { throwOnError: true },
      ),
      queryClient.refetchQueries(
        { queryKey: ["s7-debts", scopeClinicId, scopeActor], type: "active" },
        { throwOnError: true },
      ),
      queryClient.refetchQueries(
        {
          queryKey: ["s7-finance-operations", scopeClinicId, scopeActor],
          type: "active",
        },
        { throwOnError: true },
      ),
    ]);
    void queryClient.invalidateQueries({ queryKey: ["s7-report"] });
  };
  const stableId = (actor: string, scopeClinicId: string, action: string) =>
    getPersistentClientRequestId(actor, scopeClinicId, action);
  const clearId = (sync: PendingSync) =>
    clearPersistentClientRequestId(sync.actor, sync.clinicId, sync.action);
  const isActiveScope = (sync: PendingSync) =>
    isFinanceScopeActive(activeScopeRef.current, sync);
  const reconcile = async (sync: PendingSync) => {
    if (!isActiveScope(sync)) return;
    setPendingSync(sync);
    try {
      await refresh(sync.clinicId, sync.actor);
      if (!isActiveScope(sync)) return;
      clearId(sync);
      setPendingSync(null);
    } catch {
      if (!isActiveScope(sync)) return;
      toast.warning(
        uz
          ? "Amal saqlandi, lekin ro‘yxat yangilanmadi. Faqat ma’lumotlarni qayta yuklang."
          : "Операция сохранена, но список не обновился. Повторите только загрузку данных.",
      );
    }
  };
  const retrySync = async () => {
    if (!pendingSync) return;
    const sync = pendingSync;
    setSyncRetrying(true);
    try {
      await refresh(sync.clinicId, sync.actor);
      if (!isActiveScope(sync)) return;
      clearId(sync);
      setPendingSync(null);
      toast.success(uz ? "Ma’lumotlar yangilandi" : "Данные обновлены");
    } catch {
      if (isActiveScope(sync)) {
        toast.error(uz ? "Ma’lumotlarni yangilab bo‘lmadi" : "Не удалось обновить данные");
      }
    } finally {
      if (isActiveScope(sync)) setSyncRetrying(false);
    }
  };

  const createInvoice = useMutation({
    onMutate: () => ({
      actor,
      clinicId,
    }),
    mutationFn: async () => {
      const amount = Number(subtotal);
      if (!invoiceValid) throw new Error(uz ? "Bemor va summani kiriting" : "Укажите пациента и сумму");
      const scopeClinicId = clinicId!;
      const action = `invoice:${patientId}:${amount}`;
      await createClinicInvoice(scopeClinicId, {
        clientRequestId: stableId(actor, scopeClinicId, action),
        patientId,
        subtotal: amount,
      });
      return { action, actor, clinicId: scopeClinicId };
    },
    onSuccess: async (sync) => {
      const scopedSync: PendingSync = { kind: "invoice", ...sync };
      if (!isActiveScope(scopedSync)) return;
      toast.success(uz ? "Hisob yaratildi" : "Счёт создан");
      setSubtotal("");
      setInvoiceAttempted(false);
      await reconcile(scopedSync);
    },
    onError: (error: Error, _variables, scope) => {
      if (
        scope?.actor &&
        scope.clinicId &&
        isFinanceScopeActive(activeScopeRef.current, {
          actor: scope.actor,
          clinicId: scope.clinicId,
        })
      ) {
        toast.error(error.message);
      }
    },
  });
  const pay = useMutation({
    onMutate: () => ({
      actor,
      clinicId,
    }),
    mutationFn: async () => {
      const amount = Number(paymentAmount);
      if (!paymentValid) throw new Error(uz ? "Hisob va to‘g‘ri summani tanlang" : "Выберите счёт и укажите сумму не больше остатка");
      const scopeClinicId = clinicId!;
      const action = `payment:${invoiceId}:${amount}:${paymentMethod}`;
      await createClinicPayment(scopeClinicId, {
        clientRequestId: stableId(actor, scopeClinicId, action),
        invoiceId,
        amount,
        method: paymentMethod,
      });
      return { action, actor, clinicId: scopeClinicId };
    },
    onSuccess: async (sync) => {
      const scopedSync: PendingSync = { kind: "payment", ...sync };
      if (!isActiveScope(scopedSync)) return;
      toast.success(uz ? "To‘lov saqlandi" : "Платёж сохранён");
      setPaymentAmount("");
      setPaymentAttempted(false);
      await reconcile(scopedSync);
    },
    onError: (error: Error, _variables, scope) => {
      if (
        scope?.actor &&
        scope.clinicId &&
        isFinanceScopeActive(activeScopeRef.current, {
          actor: scope.actor,
          clinicId: scope.clinicId,
        })
      ) {
        toast.error(error.message);
      }
    },
  });
  const refund = useMutation({
    onMutate: () => ({
      actor,
      clinicId,
    }),
    mutationFn: async () => {
      const amount = Number(refundAmount);
      if (!refundValid) {
        throw new Error(uz ? "To‘lov, to‘g‘ri summa va sababni kiriting" : "Укажите платёж, сумму не больше оплаты и причину");
      }
      const scopeClinicId = clinicId!;
      const action = `refund:${paymentId}:${amount}:${refundReason.trim()}`;
      await refundClinicPayment(scopeClinicId, paymentId, {
        clientRequestId: stableId(actor, scopeClinicId, action),
        amount,
        reason: refundReason.trim(),
      });
      return { action, actor, clinicId: scopeClinicId };
    },
    onSuccess: async (sync) => {
      const scopedSync: PendingSync = { kind: "refund", ...sync };
      if (!isActiveScope(scopedSync)) return;
      toast.success(uz ? "Qaytarish saqlandi" : "Возврат сохранён");
      setRefundAmount("");
      setRefundReason("");
      setRefundAttempted(false);
      await reconcile(scopedSync);
    },
    onError: (error: Error, _variables, scope) => {
      if (
        scope?.actor &&
        scope.clinicId &&
        isFinanceScopeActive(activeScopeRef.current, {
          actor: scope.actor,
          clinicId: scope.clinicId,
        })
      ) {
        toast.error(error.message);
      }
    },
  });

  if (!clinicId) return null;

  return (
    <div className="space-y-5">
      {pendingSync && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-status-warning/40 bg-status-warning-bg p-4 text-sm sm:flex-row sm:items-center"
        >
          <span className="min-w-0 flex-1">
            {uz
              ? "Amal saqlandi. Takrorlamang — faqat ma’lumotlarni yangilang."
              : "Операция сохранена. Не повторяйте её — обновите только данные."}
          </span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={syncRetrying}
            onClick={() => void retrySync()}
          >
            {syncRetrying ? (uz ? "Yangilanmoqda…" : "Обновляем…") : (uz ? "Yangilash" : "Обновить данные")}
          </Button>
        </div>
      )}
      {focus === "invoices" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base font-bold"><FilePlus2 className="h-5 w-5" />{uz ? "Yangi hisob" : "Новый счёт"}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="finance-patient-search">{uz ? "Bemor qidirish" : "Поиск пациента"}</Label>
              <Input id="finance-patient-search" className="min-h-11" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} />
              {patients.data && patients.data.length > 0 && (
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="min-h-11" aria-label={uz ? "Bemor" : "Пациент"} aria-invalid={invoiceAttempted && !patientId}><SelectValue placeholder={uz ? "Bemor" : "Пациент"} /></SelectTrigger>
                  <SelectContent>{patients.data.filter((row) => row.patient_type === "registered").map((row) => <SelectItem key={String(row.id)} value={String(row.id)}>{String(row.name || "—")}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2"><Label htmlFor="invoice-subtotal">{uz ? "Summa (UZS)" : "Сумма (UZS)"}</Label><Input id="invoice-subtotal" className="min-h-11" type="number" min="1" value={subtotal} aria-invalid={invoiceAttempted && (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0)} onChange={(event) => setSubtotal(event.target.value)} /></div>
            <Button className="min-h-11 self-end" disabled={createInvoice.isPending || Boolean(pendingSync)} onClick={() => { setInvoiceAttempted(true); createInvoice.mutate(); }}>{uz ? "Hisob yaratish" : "Создать счёт"}</Button>
          </CardContent>
        </Card>
      )}

      {focus === "payments" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base font-bold"><Banknote className="h-5 w-5" />{uz ? "To‘lov" : "Платёж"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>{uz ? "Hisob" : "Счёт"}</Label>
              <Select value={invoiceId} onValueChange={setInvoiceId}><SelectTrigger className="min-h-11" aria-label={uz ? "Hisob" : "Счёт" } aria-invalid={paymentAttempted && !selectedInvoice}><SelectValue placeholder={uz ? "Hisobni tanlang" : "Выберите счёт"} /></SelectTrigger><SelectContent>{invoiceRows.filter((row) => Number(row.balance_due || 0) > 0).map((row) => <SelectItem key={String(row.id)} value={String(row.id)}>{String(row.patient_name || "—")} · {String(row.invoice_number)} · {formatPrice(Number(row.balance_due), String(row.currency || "UZS"), false)}</SelectItem>)}</SelectContent></Select>
              <Label htmlFor="payment-amount">{uz ? "Summa" : "Сумма"} ({String(selectedInvoice?.currency || "UZS")})</Label>
              <Input id="payment-amount" className="min-h-11" type="number" min="1" max={Number(selectedInvoice?.balance_due || 0) || undefined} placeholder={uz ? "Summa" : "Сумма"} value={paymentAmount} aria-invalid={paymentAttempted && !paymentValid} onChange={(event) => setPaymentAmount(event.target.value)} />
              <Label>{uz ? "To‘lov usuli" : "Способ оплаты"}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="min-h-11" aria-label={uz ? "To‘lov usuli" : "Способ оплаты"}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">{uz ? "Naqd" : "Наличные"}</SelectItem><SelectItem value="CARD">{uz ? "Karta" : "Карта"}</SelectItem><SelectItem value="TRANSFER">{uz ? "O‘tkazma" : "Перевод"}</SelectItem></SelectContent></Select>
              <Button className="min-h-11" disabled={pay.isPending || Boolean(pendingSync)} onClick={() => { setPaymentAttempted(true); pay.mutate(); }}>{uz ? "Saqlash" : "Сохранить"}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base font-bold"><RefreshCcw className="h-5 w-5" />{uz ? "Qaytarish" : "Возврат"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>{uz ? "To‘lov" : "Платёж"}</Label>
              <Select value={paymentId} onValueChange={setPaymentId}><SelectTrigger className="min-h-11" aria-label={uz ? "To‘lov" : "Платёж"} aria-invalid={refundAttempted && !selectedPayment}><SelectValue placeholder={uz ? "To‘lovni tanlang" : "Выберите платёж"} /></SelectTrigger><SelectContent>{paymentRows.map((row) => <SelectItem key={String(row.payment_id)} value={String(row.payment_id)}>{String(row.invoice_number || row.payment_id)} · {formatPrice(Number(row.amount), String(row.currency || "UZS"), false)}</SelectItem>)}</SelectContent></Select>
              <Label htmlFor="refund-amount">{uz ? "Summa" : "Сумма"} ({String(selectedPayment?.currency || "UZS")})</Label>
              <Input id="refund-amount" className="min-h-11" type="number" min="1" max={Number(selectedPayment?.amount || 0) || undefined} placeholder={uz ? "Summa" : "Сумма"} value={refundAmount} aria-invalid={refundAttempted && !refundValid} onChange={(event) => setRefundAmount(event.target.value)} />
              <Label htmlFor="refund-reason">{uz ? "Sabab" : "Причина"}</Label>
              <Textarea id="refund-reason" placeholder={uz ? "Sabab" : "Причина"} value={refundReason} aria-invalid={refundAttempted && !refundReason.trim()} onChange={(event) => setRefundReason(event.target.value)} />
              <AlertDialog open={refundConfirmOpen} onOpenChange={setRefundConfirmOpen}>
                <Button
                  type="button"
                  className="min-h-11"
                  variant="destructive"
                  disabled={refund.isPending || Boolean(pendingSync)}
                  onClick={() => {
                    setRefundAttempted(true);
                    if (refundValid) setRefundConfirmOpen(true);
                  }}
                >
                  {uz ? "Qaytarish" : "Оформить возврат"}
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{uz ? "Qaytarishni tasdiqlaysizmi?" : "Подтвердить возврат?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {uz
                        ? "Pulni qaytarish moliyaviy tarixga yoziladi. Summani va sababni yana tekshiring."
                        : "Возврат попадёт в финансовую историю. Ещё раз проверьте сумму и причину."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{uz ? "Bekor qilish" : "Отмена"}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => refund.mutate()}
                    >
                      {uz ? "Qaytarishni tasdiqlash" : "Подтвердить возврат"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>{focus === "debts" ? (uz ? "Qarzlar" : "Долги") : (uz ? "Hisoblar" : "Счета")}</CardTitle></CardHeader>
        <CardContent>
          {(focus === "debts" ? debts.isLoading : invoices.isLoading) ? <Skeleton className="h-40" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <caption className="sr-only">{focus === "debts" ? (uz ? "Qarzlar" : "Долги") : (uz ? "Hisoblar" : "Счета")}</caption>
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="p-3">{uz ? "Hisob" : "Счёт"}</th>
                    <th scope="col" className="p-3">{uz ? "Bemor" : "Пациент"}</th>
                    <th scope="col" className="p-3">{uz ? "Holat" : "Статус"}</th>
                    <th scope="col" className="p-3 text-right">{uz ? "Qoldiq" : "Остаток"}</th>
                    <th scope="col" className="p-3 text-right">
                      <span className="sr-only">{uz ? "Amallar" : "Действия"}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>{(focus === "debts" ? debtRows : invoiceRows).map((row) => {
                  const invoiceKey = String(row.id || row.invoice_id || "");
                  const balance = Number(row.balance_due || 0);
                  return (
                    <tr key={invoiceKey} className="border-b">
                      <td className="p-3 tabular-nums">{String(row.invoice_number || "—")}</td>
                      <td className="p-3">{String(row.patient_name || "—")}</td>
                      <td className="p-3">{String(row.status || "—")}</td>
                      <td className="p-3 text-right font-medium tabular-nums">{formatPrice(balance, String(row.currency || "UZS"), false)}</td>
                      <td className="p-3 text-right">
                        {/*
                          The action belongs where the object is. Before this the
                          debts table had four cells and zero buttons: the
                          administrator read "Karimov owes 450 000", switched to
                          the Payments tab, lost the row, and had to find the
                          invoice number from memory in a flat dropdown.
                        */}
                        {balance > 0 && invoiceKey ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-11"
                            onClick={() => startPaymentFor(invoiceKey, balance)}
                          >
                            <Banknote aria-hidden="true" className="mr-2 h-4 w-4" />
                            {uz ? "To‘lovni qabul qilish" : "Принять оплату"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
