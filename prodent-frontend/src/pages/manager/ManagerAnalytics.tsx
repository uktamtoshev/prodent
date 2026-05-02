import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { ManagerLayout } from '@/components/manager/ManagerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Inbox,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';

interface KpiDailyRow {
  clinic_id: string;
  day: string;
  appointments_count: number;
  completed_count: number;
  no_show_count: number;
  cancelled_count: number;
  revenue: number;
}

const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} UZS`;

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PIE_COLORS = ['#10b981', '#f43f5e', '#f59e0b'];

export default function ManagerAnalytics() {
  const { currentClinic } = useClinic();
  const clinicId = currentClinic?.id;

  // Default: last 30 days
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const [dateFrom, setDateFrom] = useState<string>(ymd(defaultFrom));
  const [dateTo, setDateTo] = useState<string>(ymd(today));

  // Compute previous period dates (same length)
  const prevRange = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const diff = Math.max(
      1,
      Math.round((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1,
    );
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (diff - 1));
    return { prevFrom: ymd(prevFrom), prevTo: ymd(prevTo), days: diff };
  }, [dateFrom, dateTo]);

  // Current period
  const { data: rows, isLoading } = useQuery<KpiDailyRow[]>({
    queryKey: ['manager-analytics-kpi', clinicId, dateFrom, dateTo],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from('v_clinic_kpi_daily')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('day', dateFrom)
        .lte('day', dateTo)
        .order('day', { ascending: true });
      if (error) throw error;
      return (data as KpiDailyRow[]) || [];
    },
    enabled: !!clinicId,
  });

  // Previous period
  const { data: prevRows, isLoading: prevLoading } = useQuery<KpiDailyRow[]>({
    queryKey: ['manager-analytics-prev', clinicId, prevRange.prevFrom, prevRange.prevTo],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from('v_clinic_kpi_daily')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('day', prevRange.prevFrom)
        .lte('day', prevRange.prevTo);
      if (error) throw error;
      return (data as KpiDailyRow[]) || [];
    },
    enabled: !!clinicId,
  });

  // Build zero-filled daily series for charts
  const series = useMemo(() => {
    const map = new Map<string, KpiDailyRow>();
    (rows || []).forEach((r) => map.set(r.day?.slice(0, 10), r));

    const out: {
      day: string;
      label: string;
      appointments: number;
      revenue: number;
      completed: number;
      noShow: number;
      cancelled: number;
    }[] = [];
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const cur = new Date(start);
    let safety = 0;
    while (cur <= end && safety < 366) {
      const key = ymd(cur);
      const r = map.get(key);
      out.push({
        day: key,
        label: `${String(cur.getDate()).padStart(2, '0')}.${String(cur.getMonth() + 1).padStart(2, '0')}`,
        appointments: r?.appointments_count || 0,
        revenue: Number(r?.revenue || 0),
        completed: r?.completed_count || 0,
        noShow: r?.no_show_count || 0,
        cancelled: r?.cancelled_count || 0,
      });
      cur.setDate(cur.getDate() + 1);
      safety++;
    }
    return out;
  }, [rows, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const list = rows || [];
    const appointments = list.reduce((s, r) => s + (r.appointments_count || 0), 0);
    const completed = list.reduce((s, r) => s + (r.completed_count || 0), 0);
    const noShow = list.reduce((s, r) => s + (r.no_show_count || 0), 0);
    const cancelled = list.reduce((s, r) => s + (r.cancelled_count || 0), 0);
    const revenue = list.reduce((s, r) => s + Number(r.revenue || 0), 0);
    const conversion = appointments > 0 ? (completed / appointments) * 100 : 0;
    return { appointments, completed, noShow, cancelled, revenue, conversion };
  }, [rows]);

  const prevTotals = useMemo(() => {
    const list = prevRows || [];
    const appointments = list.reduce((s, r) => s + (r.appointments_count || 0), 0);
    const completed = list.reduce((s, r) => s + (r.completed_count || 0), 0);
    const revenue = list.reduce((s, r) => s + Number(r.revenue || 0), 0);
    const conversion = appointments > 0 ? (completed / appointments) * 100 : 0;
    return { appointments, completed, revenue, conversion };
  }, [prevRows]);

  const pieData = useMemo(
    () => [
      { name: 'Завершено', value: totals.completed, color: PIE_COLORS[0] },
      { name: 'Неявка', value: totals.noShow, color: PIE_COLORS[1] },
      { name: 'Отмена', value: totals.cancelled, color: PIE_COLORS[2] },
    ],
    [totals],
  );

  const pieHasData = pieData.some((d) => d.value > 0);

  const setQuickRange = (days: number) => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
    setDateFrom(ymd(from));
    setDateTo(ymd(to));
  };

  const compareRow = (label: string, current: number, prev: number, isMoney = false) => {
    const delta = current - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : current > 0 ? 100 : 0;
    const fmt = (v: number) =>
      isMoney ? formatMoney(v) : v.toLocaleString('ru-RU');
    let Trend = Minus;
    let trendClass = 'text-muted-foreground';
    if (delta > 0) {
      Trend = TrendingUp;
      trendClass = 'text-emerald-500';
    } else if (delta < 0) {
      Trend = TrendingDown;
      trendClass = 'text-rose-500';
    }
    return (
      <TableRow key={label}>
        <TableCell className="font-medium">{label}</TableCell>
        <TableCell>{fmt(current)}</TableCell>
        <TableCell className="text-muted-foreground">{fmt(prev)}</TableCell>
        <TableCell>
          <span className={`inline-flex items-center gap-1 ${trendClass}`}>
            <Trend className="w-3.5 h-3.5" />
            {pct >= 0 ? '+' : ''}
            {pct.toFixed(1)}%
          </span>
        </TableCell>
      </TableRow>
    );
  };

  if (!clinicId) {
    return (
      <ManagerLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              Аналитика
            </h1>
            <p className="text-muted-foreground mt-1">Детальная аналитика и отчёты</p>
          </div>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Inbox className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>Выберите клинику для отображения данных</p>
            </CardContent>
          </Card>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              Аналитика
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentClinic?.name} • Детальная аналитика и отчёты
            </p>
          </div>
        </div>

        {/* Date filters */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-end flex-wrap">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  С
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  По
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
                  7 дней
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
                  30 дней
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>
                  90 дней
                </Button>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Период: {prevRange.days} дн. · Сравнение с предыдущим периодом{' '}
              <Badge variant="outline" className="ml-1">
                {prevRange.prevFrom} — {prevRange.prevTo}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Записи по дням</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        dataKey="appointments"
                        name="Записи"
                        fill="hsl(var(--primary))"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Выручка по дням</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1000
                              ? `${(v / 1000).toFixed(0)}K`
                              : `${v}`
                        }
                      />
                      <Tooltip
                        formatter={(v: number) => [formatMoney(Number(v)), 'Выручка']}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        name="Выручка"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pie + comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">
                Распределение записей по статусам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : !pieHasData ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  Нет данных в выбранном диапазоне
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(e) => `${e.name}: ${e.value}`}
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Сравнение периодов</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || prevLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Метрика</TableHead>
                      <TableHead>Текущий</TableHead>
                      <TableHead>Предыдущий</TableHead>
                      <TableHead>Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compareRow('Выручка', totals.revenue, prevTotals.revenue, true)}
                    {compareRow(
                      'Записи',
                      totals.appointments,
                      prevTotals.appointments,
                    )}
                    {compareRow(
                      'Конверсия (%)',
                      Number(totals.conversion.toFixed(1)),
                      Number(prevTotals.conversion.toFixed(1)),
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ManagerLayout>
  );
}
