import { useState, useMemo } from 'react';
import { AccountantLayout } from '@/components/accountant/AccountantLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  CheckCircle2,
  Eye,
  CalendarRange,
  Wallet,
  AlertTriangle,
  Search,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'ALL';

interface InvoiceRow {
  id: string;
  invoice_number?: string | null;
  clinic_id?: string;
  patient_id?: string | null;
  total?: number | null;
  final_amount?: number | null;
  currency?: string | null;
  status?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  notes?: string | null;
  patient?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string;
  } | null;
}

const statusBadge = (status?: string | null) => {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'PAID':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">Оплачен</Badge>;
    case 'UNPAID':
      return <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/40">Не оплачен</Badge>;
    case 'OVERDUE':
      return <Badge className="bg-red-500/15 text-red-400 border border-red-500/40">Просрочен</Badge>;
    case 'DRAFT':
      return <Badge className="bg-slate-500/15 text-slate-300 border border-slate-500/40">Черновик</Badge>;
    case 'CANCELLED':
      return <Badge className="bg-zinc-700/40 text-zinc-400 border border-zinc-600/60">Отменён</Badge>;
    default:
      return <Badge variant="outline">{status || '—'}</Badge>;
  }
};

const formatMoney = (val?: number | null, currency = 'UZS') => {
  const n = Number(val ?? 0);
  return `${n.toLocaleString('ru-RU')} ${currency || 'UZS'}`;
};

const patientName = (p?: InvoiceRow['patient']) => {
  if (!p) return 'Не указан';
  if (p.full_name) return p.full_name;
  const fn = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return fn || 'Не указан';
};

export default function AccountantInvoices() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(format(firstOfMonth, 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InvoiceRow | null>(null);

  const queryKey = ['accountant-invoices', currentClinic?.id, statusFilter, dateFrom, dateTo];

  const { data: invoices, isLoading, isError } = useQuery<InvoiceRow[]>({
    queryKey,
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          clinic_id,
          patient_id,
          total,
          final_amount,
          currency,
          status,
          due_date,
          paid_at,
          created_at,
          notes,
          patient:users!invoices_patient_id_fkey(id, first_name, last_name, full_name, phone)
        `)
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      return (data as InvoiceRow[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Готово', description: 'Счёт помечен как оплаченный' });
      queryClient.invalidateQueries({ queryKey: ['accountant-invoices'] });
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message ?? 'Не удалось обновить счёт',
        variant: 'destructive',
      });
    },
  });

  const filtered = useMemo(() => {
    const list = invoices || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((inv) => {
      const num = (inv.invoice_number || '').toLowerCase();
      const pn = patientName(inv.patient).toLowerCase();
      return num.includes(q) || pn.includes(q);
    });
  }, [invoices, search]);

  const kpis = useMemo(() => {
    const list = invoices || [];
    const total = list.length;
    const unpaidAmount = list
      .filter((i) => ['UNPAID', 'OVERDUE', 'DRAFT'].includes((i.status || '').toUpperCase()))
      .reduce((sum, i) => sum + Number(i.total ?? i.final_amount ?? 0), 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthRevenue = list
      .filter((i) => {
        const isPaid = (i.status || '').toUpperCase() === 'PAID';
        const d = i.paid_at ? new Date(i.paid_at) : i.created_at ? new Date(i.created_at) : null;
        return isPaid && d && d >= monthStart;
      })
      .reduce((sum, i) => sum + Number(i.total ?? i.final_amount ?? 0), 0);

    return { total, unpaidAmount, monthRevenue };
  }, [invoices]);

  return (
    <AccountantLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground text-2xl lg:text-3xl">Счета</h1>
          <p className="text-muted-foreground">Управление счетами клиники</p>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Всего счетов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{kpis.total.toLocaleString('ru-RU')}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Сумма к получению
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">
                {kpis.unpaidAmount.toLocaleString('ru-RU')} UZS
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" /> Доход за месяц
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">
                {kpis.monthRevenue.toLocaleString('ru-RU')} UZS
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-slate-400 mb-1 block">Статус</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus)}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все</SelectItem>
                  <SelectItem value="DRAFT">Черновик</SelectItem>
                  <SelectItem value="UNPAID">Не оплачен</SelectItem>
                  <SelectItem value="PAID">Оплачен</SelectItem>
                  <SelectItem value="OVERDUE">Просрочен</SelectItem>
                  <SelectItem value="CANCELLED">Отменён</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-slate-400 mb-1 block">С даты</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-slate-400 mb-1 block">По дату</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>

            <div className="flex-[2] min-w-[200px]">
              <label className="text-xs text-slate-400 mb-1 block">Поиск</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Номер счёта или имя пациента"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5" /> Список счетов
              {filtered && (
                <span className="text-sm text-slate-400 font-normal">({filtered.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full bg-slate-700" />
                <Skeleton className="h-12 w-full bg-slate-700" />
                <Skeleton className="h-12 w-full bg-slate-700" />
                <Skeleton className="h-12 w-full bg-slate-700" />
              </div>
            ) : isError ? (
              <div className="text-center py-12 text-red-400">
                <XCircle className="w-12 h-12 mx-auto mb-4 opacity-70" />
                <p>Не удалось загрузить счета</p>
              </div>
            ) : !filtered || filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Счетов не найдено</p>
                <p className="text-sm mt-1">Измените фильтры или создайте новый счёт</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Номер</TableHead>
                    <TableHead className="text-slate-400">Пациент</TableHead>
                    <TableHead className="text-slate-400 text-right">Сумма</TableHead>
                    <TableHead className="text-slate-400">Статус</TableHead>
                    <TableHead className="text-slate-400">Срок оплаты</TableHead>
                    <TableHead className="text-slate-400">Создан</TableHead>
                    <TableHead className="text-slate-400 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const sUpper = (inv.status || '').toUpperCase();
                    const canMarkPaid = sUpper !== 'PAID' && sUpper !== 'CANCELLED';
                    return (
                      <TableRow key={inv.id} className="border-slate-700 hover:bg-slate-700/30">
                        <TableCell className="text-white font-medium">
                          {inv.invoice_number || inv.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-slate-200">{patientName(inv.patient)}</TableCell>
                        <TableCell className="text-right text-white font-semibold">
                          {formatMoney(inv.total ?? inv.final_amount, inv.currency || 'UZS')}
                        </TableCell>
                        <TableCell>{statusBadge(inv.status)}</TableCell>
                        <TableCell className="text-slate-300">
                          {inv.due_date
                            ? format(new Date(inv.due_date), 'dd.MM.yyyy', { locale: ru })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {inv.created_at
                            ? format(new Date(inv.created_at), 'dd.MM.yyyy', { locale: ru })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-600 text-slate-200 hover:bg-slate-700"
                              onClick={() => setSelected(inv)}
                            >
                              <Eye className="w-4 h-4 mr-1" /> просмотр
                            </Button>
                            {canMarkPaid && (
                              <Button
                                size="sm"
                                disabled={markPaidMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                onClick={() => markPaidMutation.mutate(inv.id)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> пометить как оплаченный
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* View dialog */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Счёт {selected?.invoice_number || selected?.id?.slice(0, 8)}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Подробная информация о счёте
              </DialogDescription>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Пациент</span>
                  <span className="font-medium">{patientName(selected.patient)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Сумма</span>
                  <span className="font-semibold">
                    {formatMoney(selected.total ?? selected.final_amount, selected.currency || 'UZS')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Статус</span>
                  {statusBadge(selected.status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 flex items-center gap-2">
                    <CalendarRange className="w-4 h-4" /> Срок оплаты
                  </span>
                  <span>
                    {selected.due_date
                      ? format(new Date(selected.due_date), 'dd.MM.yyyy', { locale: ru })
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Создан</span>
                  <span>
                    {selected.created_at
                      ? format(new Date(selected.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })
                      : '—'}
                  </span>
                </div>
                {selected.paid_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Оплачен</span>
                    <span className="text-emerald-400">
                      {format(new Date(selected.paid_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                  </div>
                )}
                {selected.notes && (
                  <div className="pt-2 border-t border-slate-700">
                    <span className="text-slate-400 block mb-1">Примечания</span>
                    <p className="text-slate-200">{selected.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AccountantLayout>
  );
}
