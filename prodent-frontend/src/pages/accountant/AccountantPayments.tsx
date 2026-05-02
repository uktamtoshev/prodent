import { useState, useMemo } from 'react';
import { AccountantLayout } from '@/components/accountant/AccountantLayout';
import { useQuery } from '@tanstack/react-query';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CreditCard,
  Banknote,
  Wallet,
  Download,
  CalendarDays,
  Search,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';

type PaymentMethod = 'CARD' | 'CASH' | 'PAYME' | 'CLICK' | 'UZUM' | 'ALL';
type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'ALL';

interface PaymentRow {
  id: string;
  invoice_id?: string | null;
  clinic_id?: string;
  patient_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  method?: string | null;
  status?: string | null;
  provider_tx_id?: string | null;
  metadata?: any;
  created_at?: string | null;
  patient?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string;
  } | null;
  invoice?: {
    id?: string;
    invoice_number?: string;
  } | null;
}

const methodBadge = (method?: string | null) => {
  const m = (method || '').toUpperCase();
  switch (m) {
    case 'CARD':
      return <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/40">Карта</Badge>;
    case 'CASH':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">Наличные</Badge>;
    case 'PAYME':
      return <Badge className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/40">Payme</Badge>;
    case 'CLICK':
      return <Badge className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/40">Click</Badge>;
    case 'UZUM':
      return <Badge className="bg-violet-500/15 text-violet-400 border border-violet-500/40">Uzum</Badge>;
    default:
      return <Badge variant="outline">{method || '—'}</Badge>;
  }
};

const statusBadge = (status?: string | null) => {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'PAID':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">Оплачен</Badge>;
    case 'PENDING':
      return <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/40">Ожидание</Badge>;
    case 'FAILED':
      return <Badge className="bg-red-500/15 text-red-400 border border-red-500/40">Ошибка</Badge>;
    case 'REFUNDED':
      return <Badge className="bg-slate-500/15 text-slate-300 border border-slate-500/40">Возврат</Badge>;
    default:
      return <Badge variant="outline">{status || '—'}</Badge>;
  }
};

const formatMoney = (val?: number | null, currency = 'UZS') =>
  `${Number(val ?? 0).toLocaleString('ru-RU')} ${currency || 'UZS'}`;

const patientName = (p?: PaymentRow['patient']) => {
  if (!p) return 'Не указан';
  if (p.full_name) return p.full_name;
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'Не указан';
};

const csvEscape = (val: any) => {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};

export default function AccountantPayments() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();

  const today = new Date();
  const monthStart = startOfMonth(today);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>('ALL');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(format(monthStart, 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');

  const queryKey = [
    'accountant-payments',
    currentClinic?.id,
    methodFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ];

  const { data: payments, isLoading, isError } = useQuery<PaymentRow[]>({
    queryKey,
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      let query = supabase
        .from('payments')
        .select(`
          id,
          invoice_id,
          clinic_id,
          patient_id,
          amount,
          currency,
          method,
          status,
          provider_tx_id,
          metadata,
          created_at,
          patient:users!payments_patient_id_fkey(id, first_name, last_name, full_name, phone),
          invoice:invoices!payments_invoice_id_fkey(id, invoice_number)
        `)
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (methodFilter !== 'ALL') query = query.eq('method', methodFilter);
      if (statusFilter !== 'ALL') query = query.eq('status', statusFilter);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      return (data as PaymentRow[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  const filtered = useMemo(() => {
    const list = payments || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) => {
      const pn = patientName(p.patient).toLowerCase();
      const inv = (p.invoice?.invoice_number || '').toLowerCase();
      const tx = (p.provider_tx_id || '').toLowerCase();
      return pn.includes(q) || inv.includes(q) || tx.includes(q);
    });
  }, [payments, search]);

  const kpis = useMemo(() => {
    const list = (payments || []).filter((p) => (p.status || '').toUpperCase() === 'PAID');
    const ts = today;
    const dayStart = startOfDay(ts).getTime();
    const dayEnd = endOfDay(ts).getTime();
    const wkStart = startOfWeek(ts, { weekStartsOn: 1 }).getTime();
    const moStart = startOfMonth(ts).getTime();

    let day = 0;
    let week = 0;
    let month = 0;
    list.forEach((p) => {
      if (!p.created_at) return;
      const t = new Date(p.created_at).getTime();
      const a = Number(p.amount ?? 0);
      if (t >= dayStart && t <= dayEnd) day += a;
      if (t >= wkStart) week += a;
      if (t >= moStart) month += a;
    });
    return { day, week, month };
  }, [payments]);

  const handleExportCsv = () => {
    if (!filtered || filtered.length === 0) {
      toast({
        title: 'Нет данных',
        description: 'Нет платежей для экспорта',
        variant: 'destructive',
      });
      return;
    }
    const header = ['Дата', 'Пациент', 'Счёт', 'Метод', 'Статус', 'Сумма', 'Валюта', 'TxID'];
    const rows = filtered.map((p) => [
      p.created_at ? format(new Date(p.created_at), 'yyyy-MM-dd HH:mm', { locale: ru }) : '',
      patientName(p.patient),
      p.invoice?.invoice_number || '',
      p.method || '',
      p.status || '',
      Number(p.amount ?? 0).toString(),
      p.currency || 'UZS',
      p.provider_tx_id || '',
    ]);
    const csv =
      '﻿' +
      [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_${format(today, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Экспорт', description: `Экспортировано платежей: ${filtered.length}` });
  };

  return (
    <AccountantLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-foreground text-2xl lg:text-3xl">Оплаты</h1>
            <p className="text-muted-foreground">Учёт платежей пациентов</p>
          </div>
          <Button
            onClick={handleExportCsv}
            className="bg-primary hover:bg-primary/90"
            disabled={!filtered || filtered.length === 0}
          >
            <Download className="w-4 h-4 mr-2" /> Экспорт CSV
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" /> Доход за сегодня
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">
                {kpis.day.toLocaleString('ru-RU')} UZS
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> Доход за неделю
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-400">
                {kpis.week.toLocaleString('ru-RU')} UZS
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-violet-400" /> Доход за месяц
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-400">
                {kpis.month.toLocaleString('ru-RU')} UZS
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Метод</label>
              <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as PaymentMethod)}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все</SelectItem>
                  <SelectItem value="CARD">Карта</SelectItem>
                  <SelectItem value="CASH">Наличные</SelectItem>
                  <SelectItem value="PAYME">Payme</SelectItem>
                  <SelectItem value="CLICK">Click</SelectItem>
                  <SelectItem value="UZUM">Uzum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Статус</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PaymentStatus)}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все</SelectItem>
                  <SelectItem value="PAID">Оплачен</SelectItem>
                  <SelectItem value="PENDING">Ожидание</SelectItem>
                  <SelectItem value="FAILED">Ошибка</SelectItem>
                  <SelectItem value="REFUNDED">Возврат</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">С даты</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">По дату</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Поиск</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Пациент / счёт / TxID"
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
              <CreditCard className="w-5 h-5" /> Платежи
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
                <p>Не удалось загрузить платежи</p>
              </div>
            ) : !filtered || filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Banknote className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Платежей не найдено</p>
                <p className="text-sm mt-1">Попробуйте изменить фильтры</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Дата</TableHead>
                    <TableHead className="text-slate-400">Пациент</TableHead>
                    <TableHead className="text-slate-400 text-right">Сумма</TableHead>
                    <TableHead className="text-slate-400">Метод</TableHead>
                    <TableHead className="text-slate-400">Статус</TableHead>
                    <TableHead className="text-slate-400">Счёт</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell className="text-slate-300 whitespace-nowrap">
                        {p.created_at
                          ? format(new Date(p.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {patientName(p.patient)}
                      </TableCell>
                      <TableCell className="text-right text-white font-semibold">
                        {formatMoney(p.amount, p.currency || 'UZS')}
                      </TableCell>
                      <TableCell>{methodBadge(p.method)}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-slate-300">
                        {p.invoice?.invoice_number || '—'}
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
