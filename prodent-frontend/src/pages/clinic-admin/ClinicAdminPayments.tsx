import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Wallet,
  FileText,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Download,
  Receipt,
} from 'lucide-react';

import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Payment {
  id: string;
  clinic_id: string;
  user_id?: string | null;
  invoice_id?: string | null;
  amount: number;
  currency?: string | null;
  status: string;
  method?: string | null;
  created_at: string;
  description?: string | null;
}

interface Invoice {
  id: string;
  clinic_id: string;
  patient_id?: string | null;
  invoice_number?: string | null;
  total_amount: number;
  status: string;
  currency?: string | null;
  created_at: string;
  due_date?: string | null;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  completed: 'Завершён',
  pending: 'В обработке',
  failed: 'Ошибка',
  refunded: 'Возврат',
  cancelled: 'Отменён',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  paid: 'Оплачен',
  unpaid: 'Не оплачен',
  partial: 'Частично',
  overdue: 'Просрочен',
  cancelled: 'Отменён',
  draft: 'Черновик',
};

function paymentStatusBadge(s: string): string {
  switch (s) {
    case 'completed': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    case 'pending': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'failed':
    case 'cancelled': return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
    case 'refunded': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
}

function invoiceStatusBadge(s: string): string {
  switch (s) {
    case 'paid': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    case 'partial': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'overdue': return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
    case 'unpaid':
    case 'draft': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    case 'cancelled': return 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => {
      const v = r[h] ?? '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(',')),
  ].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClinicAdminPayments() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const clinicId = currentClinic?.id;
  const [tab, setTab] = useState<'payments' | 'invoices'>('payments');

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['clinic-admin-payments-list', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as Payment[];
    },
    enabled: !!clinicId,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['clinic-admin-invoices-list', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as Invoice[];
    },
    enabled: !!clinicId,
  });

  const { data: debtors } = useQuery({
    queryKey: ['clinic-admin-debtors', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_debtors')
        .select('*')
        .eq('clinic_id', clinicId);
      // v_debtors view may not exist for every deployment — fallback gracefully
      if (error) return [] as any[];
      return data || [];
    },
    enabled: !!clinicId,
    retry: false,
  });

  const todayRevenue = useMemo(() => {
    if (!payments) return 0;
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    return payments
      .filter((p) => p.status === 'completed')
      .filter((p) => {
        const d = parseISO(p.created_at);
        return d >= start && d <= end;
      })
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  }, [payments]);

  const pendingInvoicesCount = useMemo(() => {
    if (!invoices) return 0;
    return invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial' || i.status === 'draft').length;
  }, [invoices]);

  const overdueAmount = useMemo(() => {
    if (Array.isArray(debtors) && debtors.length > 0) {
      return debtors.reduce((s: number, d: any) => s + Number(d.amount || d.debt || d.balance || 0), 0);
    }
    if (!invoices) return 0;
    const now = new Date();
    return invoices
      .filter((i) => i.due_date && i.status !== 'paid' && i.status !== 'cancelled' && parseISO(i.due_date) < now)
      .reduce((s, i) => s + Number(i.total_amount || 0), 0);
  }, [debtors, invoices]);

  const exportPayments = () => {
    if (!payments?.length) {
      toast({ title: 'Нет данных', description: 'Нечего экспортировать', variant: 'destructive' });
      return;
    }
    downloadCsv(
      `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      payments.map((p) => ({
        id: p.id,
        date: p.created_at,
        amount: p.amount,
        currency: p.currency || 'UZS',
        status: p.status,
        method: p.method || '',
        invoice_id: p.invoice_id || '',
      })),
    );
  };

  const exportInvoices = () => {
    if (!invoices?.length) {
      toast({ title: 'Нет данных', description: 'Нечего экспортировать', variant: 'destructive' });
      return;
    }
    downloadCsv(
      `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      invoices.map((i) => ({
        id: i.id,
        number: i.invoice_number || '',
        date: i.created_at,
        due_date: i.due_date || '',
        total: i.total_amount,
        currency: i.currency || 'UZS',
        status: i.status,
      })),
    );
  };

  return (
    <ClinicAdminLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            Касса и оплаты
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentClinic ? currentClinic.name : 'Выберите клинику'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Доход сегодня
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {todayRevenue.toLocaleString('ru-RU')} UZS
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-500" />
                Открытые счета
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{pendingInvoicesCount}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Долги
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(overdueAmount).toLocaleString('ru-RU')} UZS
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'payments' | 'invoices')}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="payments" className="gap-2">
                <CreditCard className="w-4 h-4" /> Платежи
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2">
                <FileText className="w-4 h-4" /> Счета
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={tab === 'payments' ? exportPayments : exportInvoices}
            >
              <Download className="w-4 h-4" /> Экспорт CSV
            </Button>
          </div>

          <TabsContent value="payments" className="mt-4">
            <Card className="border-border/50">
              <CardContent className="p-0 overflow-x-auto">
                {paymentsLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !payments || payments.length === 0 ? (
                  <div className="py-16 flex flex-col items-center text-center">
                    <CreditCard className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Платежей пока нет</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Метод</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Описание</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(parseISO(p.created_at), 'd MMM yyyy HH:mm', { locale: ru })}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-medium">
                            {Number(p.amount).toLocaleString('ru-RU')} {p.currency || 'UZS'}
                          </TableCell>
                          <TableCell className="capitalize">{p.method || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={paymentStatusBadge(p.status)}>
                              {PAYMENT_STATUS_LABELS[p.status] || p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <span className="line-clamp-1 text-sm text-muted-foreground">
                              {p.description || '—'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <Card className="border-border/50">
              <CardContent className="p-0 overflow-x-auto">
                {invoicesLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !invoices || invoices.length === 0 ? (
                  <div className="py-16 flex flex-col items-center text-center">
                    <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Счетов пока нет</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Срок оплаты</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.invoice_number || i.id.slice(0, 8)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(parseISO(i.created_at), 'd MMM yyyy', { locale: ru })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {i.due_date ? format(parseISO(i.due_date), 'd MMM yyyy', { locale: ru }) : '—'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-medium">
                            {Number(i.total_amount).toLocaleString('ru-RU')} {i.currency || 'UZS'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={invoiceStatusBadge(i.status)}>
                              {INVOICE_STATUS_LABELS[i.status] || i.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ClinicAdminLayout>
  );
}
