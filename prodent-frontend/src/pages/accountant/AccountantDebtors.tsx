import { AccountantLayout } from "@/components/accountant/AccountantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, DollarSign, Phone } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AccountantDebtors() {
  const { currentClinic } = useClinic();

  const { data: debtors, isLoading } = useQuery({
    queryKey: ["debtors-list", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      // Получаем все неоплаченные счета
      const { data: unpaidInvoices } = await supabase
        .from("invoices")
        .select(`
          patient_id,
          final_amount,
          created_at,
          patient:profiles!invoices_patient_id_fkey(id, full_name, phone, avatar_url)
        `)
        .eq("clinic_id", currentClinic.id)
        .in("status", ["new", "sent"]);

      if (!unpaidInvoices) return [];

      // Группируем по пациентам
      const debtorMap = new Map();

      unpaidInvoices.forEach((invoice) => {
        const patientId = invoice.patient_id;
        if (!debtorMap.has(patientId)) {
          debtorMap.set(patientId, {
            patient: invoice.patient,
            totalDebt: 0,
            invoicesCount: 0,
            lastInvoiceDate: invoice.created_at,
          });
        }

        const debtor = debtorMap.get(patientId);
        debtor.totalDebt += invoice.final_amount;
        debtor.invoicesCount += 1;
        if (new Date(invoice.created_at) > new Date(debtor.lastInvoiceDate)) {
          debtor.lastInvoiceDate = invoice.created_at;
        }
      });

      return Array.from(debtorMap.values()).sort(
        (a, b) => b.totalDebt - a.totalDebt
      );
    },
    enabled: !!currentClinic?.id,
  });

  if (isLoading) {
    return (
      <AccountantLayout>
        <div className="p-8 space-y-6">
          <Skeleton className="h-12 w-64 bg-slate-700" />
          <Skeleton className="h-96 w-full bg-slate-700" />
        </div>
      </AccountantLayout>
    );
  }

  const totalDebt = debtors?.reduce((sum, d) => sum + d.totalDebt, 0) || 0;

  return (
    <AccountantLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground">Долги пациентов</h1>
          <p className="text-slate-400">Управление задолженностями</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Пациенты с долгами</CardTitle>
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-xl font-bold">{totalDebt.toLocaleString()} UZS</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!debtors || debtors.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Задолженностей нет</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Пациент</TableHead>
                    <TableHead className="text-slate-400">Телефон</TableHead>
                    <TableHead className="text-slate-400 text-center">
                      Счетов
                    </TableHead>
                    <TableHead className="text-slate-400">Последний счёт</TableHead>
                    <TableHead className="text-slate-400 text-right">Долг</TableHead>
                    <TableHead className="text-slate-400">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtors.map((debtor, index) => (
                    <TableRow key={index} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell className="text-white font-medium">
                        {(debtor.patient as any)?.full_name || "Не указан"}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {(debtor.patient as any)?.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                          {debtor.invoicesCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {format(new Date(debtor.lastInvoiceDate), "dd.MM.yyyy", {
                          locale: ru,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-red-400 font-bold">
                          <DollarSign className="w-4 h-4" />
                          {debtor.totalDebt.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary text-primary hover:bg-primary/10"
                        >
                          Погасить
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AccountantLayout>
  );
}
