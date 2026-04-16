import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { AlertTriangle, User, Phone } from "lucide-react";

export function DebtsList() {
  const { currentClinic } = useClinic();

  // Get all invoices with payments
  const { data: debts, isLoading } = useQuery({
    queryKey: ["debts", currentClinic?.id],
    queryFn: async () => {
      // Get all unpaid/partially paid invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select(`
          *,
          patient:profiles!invoices_patient_id_fkey(id, full_name, phone)
        `)
        .eq("clinic_id", currentClinic?.id)
        .neq("status", "paid")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (!invoices) return [];

      // Get payments for these invoices
      const invoiceIds = invoices.map((i) => i.id);
      const { data: payments } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds)
        .eq("status", "completed");

      const paymentsMap: Record<string, number> = {};
      payments?.forEach((p) => {
        if (p.invoice_id) {
          paymentsMap[p.invoice_id] = (paymentsMap[p.invoice_id] || 0) + p.amount;
        }
      });

      // Calculate debts
      return invoices
        .map((inv) => {
          const paid = paymentsMap[inv.id] || 0;
          const debt = inv.final_amount - paid;
          return {
            ...inv,
            paid_amount: paid,
            debt_amount: debt,
          };
        })
        .filter((inv) => inv.debt_amount > 0);
    },
    enabled: !!currentClinic?.id,
  });

  // Group debts by patient
  const debtsByPatient = debts?.reduce((acc, debt) => {
    const patientId = (debt.patient as any)?.id;
    if (!acc[patientId]) {
      acc[patientId] = {
        patient: debt.patient,
        invoices: [],
        totalDebt: 0,
      };
    }
    acc[patientId].invoices.push(debt);
    acc[patientId].totalDebt += debt.debt_amount;
    return acc;
  }, {} as Record<string, any>);

  const totalDebt = debts?.reduce((sum, d) => sum + d.debt_amount, 0) || 0;

  if (isLoading) {
    return <Skeleton className="h-96 w-full bg-muted" />;
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <p className="text-sm text-red-400">Общая задолженность</p>
                <p className="text-2xl font-bold text-red-400">
                  {totalDebt.toLocaleString()} UZS
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/50">
              {Object.keys(debtsByPatient || {}).length} должников
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Debtors list */}
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Должники</CardTitle>
        </CardHeader>
        <CardContent>
          {debtsByPatient && Object.keys(debtsByPatient).length > 0 ? (
            <div className="space-y-4">
              {Object.values(debtsByPatient)
                .sort((a: any, b: any) => b.totalDebt - a.totalDebt)
                .map((group: any) => (
                  <div key={group.patient?.id} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {group.patient?.full_name || "Без имени"}
                          </p>
                          {group.patient?.phone && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {group.patient.phone}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-400">
                          {group.totalDebt.toLocaleString()} UZS
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {group.invoices.length} счетов
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pl-13">
                      {group.invoices.map((inv: any) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between text-sm p-2 bg-background/50 rounded"
                        >
                          <div>
                            <span className="font-mono text-foreground">{inv.invoice_number}</span>
                            <span className="text-muted-foreground ml-2">
                              от {format(new Date(inv.created_at), "dd.MM.yyyy", { locale: ru })}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-red-400 font-medium">
                              {inv.debt_amount.toLocaleString()} UZS
                            </span>
                            {inv.paid_amount > 0 && (
                              <span className="text-muted-foreground text-xs ml-2">
                                (оплачено {inv.paid_amount.toLocaleString()})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Задолженностей нет</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
