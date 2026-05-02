import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { ManagerLayout } from '@/components/manager/ManagerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Users,
  Smile,
  TrendingDown,
  Target as TargetIcon,
  CalendarCheck,
  Inbox,
} from 'lucide-react';

interface KpiDailyRow {
  clinic_id: string;
  day: string;
  appointments_count: number;
  completed_count: number;
  no_show_count: number;
  cancelled_count: number;
  revenue: number;
}

interface ManagerTargetRow {
  id: string;
  clinic_id: string;
  period_start: string;
  period_end: string;
  metric: string;
  target_value: number;
  actual_value: number;
  notes?: string | null;
}

interface RecentAppointmentRow {
  id: string;
  service?: string | null;
  status?: string | null;
  appointment_date?: string | null;
  patient_id?: string | null;
  doctor_id?: string | null;
}

const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} UZS`;

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const metricLabel = (m: string) => {
  switch (m) {
    case 'REVENUE':
      return 'Выручка';
    case 'APPOINTMENTS':
      return 'Записи';
    case 'NEW_PATIENTS':
      return 'Новые пациенты';
    case 'AVG_CHECK':
      return 'Средний чек';
    case 'NPS':
      return 'NPS';
    default:
      return m;
  }
};

const formatTarget = (metric: string, value: number) => {
  if (metric === 'REVENUE' || metric === 'AVG_CHECK') return formatMoney(value);
  if (metric === 'NPS') return value.toFixed(0);
  return Math.round(value).toLocaleString('ru-RU');
};

export default function ManagerDashboard() {
  const { currentClinic } = useClinic();
  const clinicId = currentClinic?.id;

  const today = useMemo(() => new Date(), []);
  const todayStr = ymd(today);
  const monthStart = useMemo(
    () => ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
    [today],
  );
  const monthEnd = useMemo(
    () => ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    [today],
  );
  const last30Start = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return ymd(d);
  }, [today]);

  // KPI rows for last 30 days (also covers month + today)
  const { data: kpiRows, isLoading: kpiLoading } = useQuery<KpiDailyRow[]>({
    queryKey: ['manager-kpi-daily', clinicId, last30Start, todayStr],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from('v_clinic_kpi_daily')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('day', last30Start)
        .lte('day', todayStr)
        .order('day', { ascending: true });
      if (error) throw error;
      return (data as KpiDailyRow[]) || [];
    },
    enabled: !!clinicId,
  });

  // Active doctors at the clinic
  const { data: activeDoctorsCount, isLoading: doctorsLoading } = useQuery<number>({
    queryKey: ['manager-active-doctors', clinicId],
    queryFn: async () => {
      if (!clinicId) return 0;
      const { data, error } = await supabase
        .from('doctor_clinic_affiliations')
        .select('doctor_id')
        .eq('clinic_id', clinicId)
        .eq('is_active', true);
      if (error) throw error;
      const set = new Set((data || []).map((r: any) => r.doctor_id));
      return set.size;
    },
    enabled: !!clinicId,
  });

  // Active monthly targets
  const { data: targets, isLoading: targetsLoading } = useQuery<ManagerTargetRow[]>({
    queryKey: ['manager-targets-current', clinicId, monthStart, monthEnd],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from('manager_targets')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('period_end', monthStart)
        .lte('period_start', monthEnd)
        .order('metric', { ascending: true });
      if (error) throw error;
      return ((data as ManagerTargetRow[]) || []).slice(0, 3);
    },
    enabled: !!clinicId,
  });

  // Recent completed appointments
  const { data: recent, isLoading: recentLoading } = useQuery<RecentAppointmentRow[]>({
    queryKey: ['manager-recent-completed', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('id, service, status, appointment_date, patient_id, doctor_id')
        .eq('clinic_id', clinicId)
        .eq('status', 'COMPLETED')
        .order('appointment_date', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as RecentAppointmentRow[]) || [];
    },
    enabled: !!clinicId,
  });

  // KPI tile aggregates
  const todayApptCount = useMemo(() => {
    const r = kpiRows?.find((x) => x.day?.slice(0, 10) === todayStr);
    return r?.appointments_count || 0;
  }, [kpiRows, todayStr]);

  const monthRevenue = useMemo(() => {
    return (kpiRows || [])
      .filter((r) => r.day?.slice(0, 10) >= monthStart)
      .reduce((s, r) => s + Number(r.revenue || 0), 0);
  }, [kpiRows, monthStart]);

  const noShowRate = useMemo(() => {
    const month = (kpiRows || []).filter((r) => r.day?.slice(0, 10) >= monthStart);
    const totalAppt = month.reduce((s, r) => s + (r.appointments_count || 0), 0);
    const noShow = month.reduce((s, r) => s + (r.no_show_count || 0), 0);
    if (!totalAppt) return 0;
    return (noShow / totalAppt) * 100;
  }, [kpiRows, monthStart]);

  // Build 30-day chart data with zero-fill
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    (kpiRows || []).forEach((r) => {
      map.set(r.day?.slice(0, 10), Number(r.revenue || 0));
    });
    const out: { day: string; label: string; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      out.push({
        day: key,
        label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        revenue: map.get(key) || 0,
      });
    }
    return out;
  }, [kpiRows, today]);

  const tiles = [
    {
      label: 'Записи сегодня',
      value: kpiLoading ? null : todayApptCount.toLocaleString('ru-RU'),
      icon: CalendarDays,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Выручка за месяц',
      value: kpiLoading ? null : formatMoney(monthRevenue),
      icon: Wallet,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Активных врачей',
      value: doctorsLoading ? null : (activeDoctorsCount ?? 0).toLocaleString('ru-RU'),
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'NPS',
      value: '—',
      icon: Smile,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Доля неявок',
      value: kpiLoading ? null : `${noShowRate.toFixed(1)}%`,
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  if (!clinicId) {
    return (
      <ManagerLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-primary" />
              </div>
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Общий обзор показателей клиники</p>
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
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentClinic?.name} • Общий обзор показателей клиники
          </p>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <Card
                key={t.label}
                className="border-border/50 bg-card/80 backdrop-blur-sm shadow-soft"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {t.label}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${t.bg}`}>
                    <Icon className={`w-4 h-4 ${t.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  {t.value === null ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <div className="text-xl font-bold text-foreground">{t.value}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Chart + Targets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Выручка за 30 дней
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kpiLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
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
                        labelFormatter={(l) => `Дата: ${l}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TargetIcon className="w-5 h-5 text-primary" />
                Цели месяца
              </CardTitle>
            </CardHeader>
            <CardContent>
              {targetsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !targets || targets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <TargetIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Целей на этот месяц нет
                </div>
              ) : (
                <div className="space-y-4">
                  {targets.map((t) => {
                    const target = Number(t.target_value || 0);
                    const actual = Number(t.actual_value || 0);
                    const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
                    return (
                      <div key={t.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">
                            {metricLabel(t.metric)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {formatTarget(t.metric, actual)} / {formatTarget(t.metric, target)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              Последние завершённые записи
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !recent || recent.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Нет завершённых записей</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recent.map((a) => (
                  <div
                    key={a.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {a.service || 'Услуга не указана'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID пациента: {a.patient_id?.slice(0, 8) || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/40">
                        Завершено
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {a.appointment_date
                          ? new Date(a.appointment_date).toLocaleDateString('ru-RU')
                          : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}
