import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, AlertTriangle, TrendingUp, Receipt, 
  CreditCard, ArrowUpRight, ArrowDownRight, Clock 
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useClinic } from "@/contexts/ClinicContext";

interface PatientFinanceTabProps {
  patientId: string;
}

const PAYMENT_METHODS: Record<string, string> = {
  cash: "Наличные", card: "Карта", transfer: "Перевод",
  uzum: "Uzum", payme: "Payme", click: "Click",
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  new: { label: "Новый", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  pending: { label: "Ожидает", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  paid: { label: "Оплачен", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  completed: { label: "Завершён", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  cancelled: { label: "Отменён", className: "bg-red-500/10 text-red-500 border-red-500/20" },
  partial: { label: "Частично", className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
};

export function PatientFinanceTab({ patientId }: PatientFinanceTabProps) {
  const { currentClinic } = useClinic();

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

  const { data: invoices, isLoading: invLoading } = useQuery({
    queryKey: ["patient-invoices-finance", patientId, currentClinic?.id],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select(`id, invoice_number, total_amount, discount_amount, final_amount, status, created_at, paid_at, payment_method,
          doctors:doctor_id ( profiles:user_id ( full_name ) )`)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (currentClinic?.id) q = q.eq("clinic_id", currentClinic.id);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: payments, isLoading: payLoading } = useQuery({
    queryKey: ["patient-payments-finance", patientId, currentClinic?.id],
    queryFn: async () => {
      let q = supabase
        .from("payments")
        .select("id, amount, currency, payment_method, status, description, created_at, invoice_id")
        .eq("user_id", patientId)
        .order("created_at", { ascending: false });
      if (currentClinic?.id) q = q.eq("clinic_id", currentClinic.id);
      const { data } = await q;
      return data || [];
    },
  });

  const isLoading = invLoading || payLoading;

  const totalInvoiced = invoices?.reduce((s, i) => s + (i.final_amount || 0), 0) || 0;
  const totalPaid = payments?.filter(p => p.status === "completed").reduce((s, p) => s + (p.amount || 0), 0) || 0;
  const unpaidInvoices = invoices?.filter(i => i.status === "new" || i.status === "pending" || i.status === "partial") || [];
  const totalDebt = unpaidInvoices.reduce((s, i) => s + (i.final_amount || 0), 0);

  const bal = balance?.balance || 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Wallet} label="Баланс" value={bal} color={bal < 0 ? "red" : "primary"} suffix="UZS" />
        <KpiCard icon={TrendingUp} label="Всего начислено" value={totalInvoiced} color="blue" suffix="UZS" />
        <KpiCard icon={ArrowUpRight} label="Оплачено" value={totalPaid} color="green" suffix="UZS" />
        <KpiCard icon={AlertTriangle} label="Задолженность" value={totalDebt} color={totalDebt > 0 ? "red" : "green"} suffix="UZS" />
      </div>

      {/* Debts */}
      {unpaidInvoices.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-500 text-base">
              <AlertTriangle className="w-5 h-5" />
              Неоплаченные счета ({unpaidInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unpaidInvoices.map(inv => {
              const st = STATUS_MAP[inv.status || "new"] || STATUS_MAP.pending;
              return (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-background/80 rounded-lg border border-border/50">
                  <div>
                    <span className="font-medium text-foreground">{inv.invoice_number || "—"}</span>
                    <Badge variant="outline" className={`ml-2 ${st.className}`}>{st.label}</Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(inv.created_at), "d MMM yyyy", { locale: ru })}
                    </p>
                  </div>
                  <span className="font-bold text-red-500">{inv.final_amount?.toLocaleString()} UZS</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Receipt className="w-5 h-5" /> Счета
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full bg-muted" />)}</div>
          ) : invoices && invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.map(inv => {
                const st = STATUS_MAP[inv.status || "new"] || STATUS_MAP.pending;
                const doc = inv.doctors as any;
                return (
                  <div key={inv.id} className="p-3 bg-muted/50 rounded-lg border border-border/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{inv.invoice_number || "—"}</span>
                          <Badge variant="outline" className={st.className}>{st.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(inv.created_at), "d MMM yyyy, HH:mm", { locale: ru })}
                          {doc?.profiles?.full_name && ` • ${doc.profiles.full_name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground text-sm">{inv.final_amount?.toLocaleString()} UZS</p>
                        {inv.discount_amount && inv.discount_amount > 0 && (
                          <p className="text-xs text-muted-foreground">-{inv.discount_amount.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    {inv.paid_at && (
                      <p className="text-xs text-green-500 mt-1">
                        Оплачен {format(new Date(inv.paid_at), "d MMM", { locale: ru })}
                        {inv.payment_method && ` • ${PAYMENT_METHODS[inv.payment_method] || inv.payment_method}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Receipt} text="Счетов нет" />
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <CreditCard className="w-5 h-5" /> Платежи
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full bg-muted" />)}</div>
          ) : payments && payments.length > 0 ? (
            <div className="space-y-2">
              {payments.map(p => {
                const st = STATUS_MAP[p.status || "pending"] || STATUS_MAP.pending;
                const done = p.status === "completed";
                return (
                  <div key={p.id} className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${done ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                        {done ? <ArrowUpRight className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-yellow-500" />}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{p.amount?.toLocaleString()} {p.currency || "UZS"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(p.created_at), "d MMM yyyy, HH:mm", { locale: ru })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{PAYMENT_METHODS[p.payment_method || ""] || p.payment_method || "—"}</span>
                      <Badge variant="outline" className={st.className}>{st.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CreditCard} text="Платежей нет" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, suffix }: { icon: any; label: string; value: number; color: string; suffix: string }) {
  const colorMap: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    blue: "text-blue-500 bg-blue-500/10",
    green: "text-green-500 bg-green-500/10",
    red: "text-red-500 bg-red-500/10",
  };
  const cls = colorMap[color] || colorMap.primary;
  const textCls = cls.split(" ")[0];

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${cls}`}>
            <Icon className={`w-5 h-5`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold ${textCls}`}>{value.toLocaleString()} {suffix}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
