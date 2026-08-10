import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Receipt, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface PatientPaymentHistoryProps {
  patientId: string;
}

type ProfileSummary = { full_name: string | null };
type LinkedDoctor =
  | { profiles: ProfileSummary | ProfileSummary[] | null }
  | { profiles: ProfileSummary | ProfileSummary[] | null }[]
  | null;

const getProfileName = (profile: ProfileSummary | ProfileSummary[] | null | undefined) =>
  Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;

const getLinkedDoctorName = (doctor: LinkedDoctor | undefined) =>
  getProfileName(Array.isArray(doctor) ? doctor[0]?.profiles : doctor?.profiles);

export function PatientPaymentHistory({ patientId }: PatientPaymentHistoryProps) {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();

  // Получаем счета пациента
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["patient-invoices", patientId, currentClinic?.id],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          total_amount,
          discount_amount,
          final_amount,
          status,
          created_at,
          paid_at,
          payment_method,
          doctors:doctor_id (
            profiles:user_id (
              full_name
            )
          )
        `)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (currentClinic?.id) {
        query = query.eq("clinic_id", currentClinic.id);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Получаем оплаты пациента
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["patient-payments", patientId, currentClinic?.id],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select(`
          id,
          amount,
          currency,
          payment_method,
          status,
          description,
          created_at,
          invoice_id
        `)
        .eq("user_id", patientId)
        .order("created_at", { ascending: false });

      if (currentClinic?.id) {
        query = query.eq("clinic_id", currentClinic.id);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Получаем баланс пациента
  const { data: balance } = useQuery({
    queryKey: ["patient-balance", patientId, currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;

      const { data } = await supabase
        .from("patient_balances")
        .select("*")
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic.id)
        .maybeSingle();

      return data;
    },
    enabled: !!currentClinic?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      new: { label: t('crmPaymentHistory.statusNew'), className: "bg-status-info/10 text-status-info border-status-info/20" },
      pending: { label: t('crmPaymentHistory.statusPending'), className: "bg-status-warning/10 text-status-warning border-status-warning/20" },
      paid: { label: t('crmPaymentHistory.statusPaid'), className: "bg-status-success/10 text-status-success border-status-success/20" },
      completed: { label: t('crmPaymentHistory.statusCompleted'), className: "bg-status-success/10 text-status-success border-status-success/20" },
      cancelled: { label: t('crmPaymentHistory.statusCancelled'), className: "bg-status-danger/10 text-status-danger border-status-danger/20" },
      partial: { label: t('crmPaymentHistory.statusPartial'), className: "bg-status-warning/25 text-status-warning border-status-warning/50" },
    };
    return variants[status] || variants.pending;
  };

  const getPaymentMethodLabel = (method: string | null) => {
    const methods: Record<string, string> = {
      cash: t('crmPaymentHistory.methodCash'),
      card: t('crmPaymentHistory.methodCard'),
      transfer: t('crmPaymentHistory.methodTransfer'),
      uzum: "Uzum",
      payme: "Payme",
      click: "Click",
    };
    return methods[method || ""] || method || "—";
  };

  const isLoading = invoicesLoading || paymentsLoading;

  // Статистика
  const totalInvoiced = invoices?.reduce((sum, inv) => sum + (inv.final_amount || 0), 0) || 0;
  const totalPaid = payments?.filter(p => p.status === "completed").reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-card-x">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-info/10">
                <Receipt className="w-5 h-5 text-status-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPaymentHistory.totalInvoiced')}</p>
                <p className="text-xl font-bold">{totalInvoiced.toLocaleString()} UZS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-card-x">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-success/10">
                <ArrowUpRight className="w-5 h-5 text-status-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPaymentHistory.paid')}</p>
                <p className="text-xl font-bold text-status-success">{totalPaid.toLocaleString()} UZS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-card-x">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${(balance?.balance || 0) < 0 ? 'bg-status-danger/10' : 'bg-primary/10'}`}>
                <CreditCard className={`w-5 h-5 ${(balance?.balance || 0) < 0 ? 'text-status-danger' : 'text-primary'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPaymentHistory.balance')}</p>
                <p className={`text-xl font-bold ${(balance?.balance || 0) < 0 ? 'text-status-danger' : 'text-primary'}`}>
                  {(balance?.balance || 0).toLocaleString()} UZS
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Счета */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Receipt className="w-5 h-5" />
            {t('crmPaymentHistory.invoicesTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full bg-muted" />
              ))}
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const status = getStatusBadge(invoice.status || "new");
                const doctorName = getLinkedDoctorName(invoice.doctors);
                
                return (
                  <div
                    key={invoice.id}
                    className="p-4 bg-muted/50 rounded-lg border border-border/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{invoice.invoice_number || "—"}</span>
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(invoice.created_at), "d MMMM yyyy, HH:mm", { locale: ru })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          {invoice.final_amount?.toLocaleString()} UZS
                        </p>
                        {invoice.discount_amount && invoice.discount_amount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t('crmPaymentHistory.discount')} {invoice.discount_amount.toLocaleString()} UZS
                          </p>
                        )}
                      </div>
                    </div>
                    {doctorName && (
                      <p className="text-sm text-muted-foreground">
                        {t('crmPaymentHistory.doctor')} {doctorName}
                      </p>
                    )}
                    {invoice.paid_at && (
                      <p className="text-sm text-status-success mt-1">
                        {t('crmPaymentHistory.paidLabel')} {format(new Date(invoice.paid_at), "d MMM yyyy", { locale: ru })}
                        {invoice.payment_method && ` • ${getPaymentMethodLabel(invoice.payment_method)}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('crmPaymentHistory.noInvoices')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Платежи */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <CreditCard className="w-5 h-5" />
            {t('crmPaymentHistory.paymentsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full bg-muted" />
              ))}
            </div>
          ) : payments && payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => {
                const status = getStatusBadge(payment.status || "pending");
                
                return (
                  <div
                    key={payment.id}
                    className="p-4 bg-muted/50 rounded-lg border border-border/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${payment.status === 'completed' ? 'bg-status-success/10' : 'bg-status-warning/10'}`}>
                        {payment.status === 'completed' ? (
                          <ArrowUpRight className="w-4 h-4 text-status-success" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-status-warning" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {payment.amount?.toLocaleString()} {payment.currency || "UZS"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(payment.created_at), "d MMM yyyy, HH:mm", { locale: ru })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {getPaymentMethodLabel(payment.payment_method)}
                      </span>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('crmPaymentHistory.noPayments')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
