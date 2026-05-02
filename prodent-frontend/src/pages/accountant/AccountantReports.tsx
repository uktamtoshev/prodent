import { useState, useMemo } from 'react';
import { AccountantLayout } from '@/components/accountant/AccountantLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Printer,
  PieChart as PieIcon,
  BarChart3,
} from 'lucide-react';
import { format, startOfMonth, eachDayOfInterval } from 'date-fns';
import { ru } from 'date-fns/locale';

interface PaymentRow {
  id: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  created_at?: string | null;
}

interface ExpenseRow {
  id: string;
  category?: string | null;
  amount?: number | null;
  currency?: string | null;
  spent_at?: string | null;
  title?: string | null;
}

interface DebtorRow {
  invoice_id: string;
  amount?: number | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  RENT: '#06b6d4',
  UTILITIES: '#8b5cf6',
  SUPPLIES: '#22c55e',
  MARKETING: '#f59e0b',
  TAX: '#ef4444',
  OTHER: '#94a3b8',
};

const CATEGORY_LABEL: Record<string, string> = {
  RENT: 'Аренда',
  UTILITIES: 'Коммунальные',
  SUPPLIES: 'Расходники',
  MARKETING: 'Маркетинг',
  TAX: 'Налоги',
  OTHER: 'Прочее',
};

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} UZS`;

export default function AccountantReports() {
  const { currentClinic } = useClinic();

  const today = new Date();
  const [dateFrom, setDateFrom] = useState<string>(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState<string>(format(today, 'yyyy-MM-dd'));

  const queryKeyBase = [currentClinic?.id, dateFrom, dateTo];

  // ─── Payments ──────────────────────────────────────────────────────
  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentRow[]>({
    queryKey: ['accountant-reports-payments', ...queryKeyBase],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, currency, status, created_at')
        .eq('clinic_id', currentClinic.id)
        .eq('status', 'PAID')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .limit(2000);
      if (error) throw error;
      return (data as PaymentRow[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // ─── Expenses ──────────────────────────────────────────────────────
  const { data: expenses, isLoading: expensesLoading } = useQuery<ExpenseRow[]>({
    queryKey: ['accountant-reports-expenses', ...queryKeyBase],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from('clinic_expenses')
        .select('id, category, amount, currency, spent_at, title')
        .eq('clinic_id', currentClinic.id)
        .gte('spent_at', dateFrom)
        .lte('spent_at', dateTo)
        .limit(2000);
      if (error) throw error;
      return (data as ExpenseRow[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // ─── Debtors count ─────────────────────────────────────────────────
  const { data: debtors } = useQuery<DebtorRow[]>({
    queryKey: ['accountant-reports-debtors', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from('v_debtors')
        .select('invoice_id, amount')
        .eq('clinic_id', currentClinic.id);
      if (error) return [];
      return (data as DebtorRow[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // ─── Aggregations ──────────────────────────────────────────────────
  const totals = useMemo(() => {
    const revenue = (payments || []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const expense = (expenses || []).reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const profit = revenue - expense;
    const debtorsCount = (debtors || []).length;
    const debtorsAmount = (debtors || []).reduce((s, d) => s + Number(d.amount ?? 0), 0);
    return { revenue, expense, profit, debtorsCount, debtorsAmount };
  }, [payments, expenses, debtors]);

  const dailyRevenue = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return [];

    const days = eachDayOfInterval({ start: from, end: to });
    const map = new Map<string, number>();
    days.forEach((d) => map.set(format(d, 'yyyy-MM-dd'), 0));

    (payments || []).forEach((p) => {
      if (!p.created_at) return;
      const key = format(new Date(p.created_at), 'yyyy-MM-dd');
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + Number(p.amount ?? 0));
      }
    });

    return Array.from(map.entries()).map(([day, revenue]) => ({
      day: format(new Date(day), 'dd.MM', { locale: ru }),
      revenue,
    }));
  }, [payments, dateFrom, dateTo]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    (expenses || []).forEach((e) => {
      const cat = (e.category || 'OTHER').toUpperCase();
      map.set(cat, (map.get(cat) || 0) + Number(e.amount ?? 0));
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        label: CATEGORY_LABEL[category] || category,
        amount,
        color: CATEGORY_COLORS[category] || '#94a3b8',
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const isLoading = paymentsLoading || expensesLoading;

  return (
    <AccountantLayout>
      <div className="p-6 lg:p-8 space-y-6 print:p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-foreground text-2xl lg:text-3xl">
              Финансовые отчёты
            </h1>
            <p className="text-muted-foreground">
              Доходы, расходы и долги клиники за период
            </p>
          </div>
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="border-slate-600 text-slate-200 hover:bg-slate-700 print:hidden"
          >
            <Printer className="w-4 h-4 mr-2" /> Экспорт PDF
          </Button>
        </div>

        {/* Date range */}
        <Card className="bg-slate-800/50 border-slate-700 print:hidden">
          <CardContent className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
            <div className="flex items-end">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-200"
                onClick={() => {
                  setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setDateTo(format(new Date(), 'yyyy-MM-dd'));
                }}
              >
                Этот месяц
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 bg-slate-700" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Доход
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">
                  {fmtMoney(totals.revenue)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" /> Расходы
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">
                  {fmtMoney(totals.expense)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <Wallet
                    className={`w-4 h-4 ${
                      totals.profit >= 0 ? 'text-cyan-400' : 'text-amber-400'
                    }`}
                  />
                  Чистая прибыль
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    totals.profit >= 0 ? 'text-cyan-400' : 'text-amber-400'
                  }`}
                >
                  {fmtMoney(totals.profit)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Должников
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-400">
                  {totals.debtorsCount.toLocaleString('ru-RU')}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Сумма: {fmtMoney(totals.debtorsAmount)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Доход по дням
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <Skeleton className="h-72 w-full bg-slate-700" />
              ) : dailyRevenue.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет данных за выбранный период</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        color: '#e2e8f0',
                      }}
                      formatter={(v: any) => [fmtMoney(Number(v)), 'Доход']}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <PieIcon className="w-5 h-5" /> Расходы по категориям
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <Skeleton className="h-72 w-full bg-slate-700" />
              ) : expensesByCategory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <PieIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Расходов за период нет</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      dataKey="amount"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry: any) =>
                        `${(entry.label as string).slice(0, 8)} ${(
                          (entry.amount /
                            (expensesByCategory.reduce((s, x) => s + x.amount, 0) || 1)) *
                          100
                        ).toFixed(0)}%`
                      }
                    >
                      {expensesByCategory.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        color: '#e2e8f0',
                      }}
                      formatter={(v: any, _n: any, ctx: any) => [
                        fmtMoney(Number(v)),
                        ctx?.payload?.label,
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }}
                      formatter={(v) => v}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Expenses table */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Категории расходов</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <p className="text-slate-400 text-center py-6">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {expensesByCategory.map((c) => {
                  const total = expensesByCategory.reduce((s, x) => s + x.amount, 0) || 1;
                  const pct = (c.amount / total) * 100;
                  return (
                    <div key={c.category} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: c.color }}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-200">{c.label}</span>
                          <span className="text-slate-300">{fmtMoney(c.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: c.color }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 w-12 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AccountantLayout>
  );
}
