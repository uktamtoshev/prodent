import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { ManagerLayout } from '@/components/manager/ManagerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
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
import { Target as TargetIcon, Plus, Pencil, Inbox, Trash2 } from 'lucide-react';

type Metric = 'REVENUE' | 'APPOINTMENTS' | 'NEW_PATIENTS' | 'AVG_CHECK' | 'NPS';

interface ManagerTargetRow {
  id: string;
  clinic_id: string;
  period_start: string;
  period_end: string;
  metric: Metric;
  target_value: number;
  actual_value: number;
  notes?: string | null;
}

interface KpiDailyRow {
  clinic_id: string;
  day: string;
  appointments_count: number;
  completed_count: number;
  no_show_count: number;
  cancelled_count: number;
  revenue: number;
}

interface AppointmentLite {
  id: string;
  clinic_id?: string;
  patient_id?: string | null;
  appointment_date?: string | null;
}

const METRICS: { value: Metric; label: string }[] = [
  { value: 'REVENUE', label: 'Выручка' },
  { value: 'APPOINTMENTS', label: 'Записи' },
  { value: 'NEW_PATIENTS', label: 'Новые пациенты' },
  { value: 'AVG_CHECK', label: 'Средний чек' },
  { value: 'NPS', label: 'NPS' },
];

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatTargetValue = (metric: Metric, value: number) => {
  if (metric === 'REVENUE' || metric === 'AVG_CHECK')
    return `${Math.round(value).toLocaleString('ru-RU')} UZS`;
  if (metric === 'NPS') return value.toFixed(0);
  return Math.round(value).toLocaleString('ru-RU');
};

const metricLabel = (m: string) => METRICS.find((x) => x.value === m)?.label || m;

interface FormState {
  metric: Metric;
  period_start: string;
  period_end: string;
  target_value: string;
  notes: string;
}

const emptyForm = (): FormState => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    metric: 'REVENUE',
    period_start: ymd(start),
    period_end: ymd(end),
    target_value: '',
    notes: '',
  };
};

export default function ManagerKPI() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = currentClinic?.id;

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(
    () => ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
    [today],
  );

  // Filters
  const [metricFilter, setMetricFilter] = useState<Metric | 'ALL'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<'CURRENT' | 'PAST' | 'ALL'>(
    'CURRENT',
  );

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagerTargetRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  // Targets
  const { data: targets, isLoading } = useQuery<ManagerTargetRow[]>({
    queryKey: ['manager-targets', clinicId, periodFilter, metricFilter],
    queryFn: async () => {
      if (!clinicId) return [];
      let query = supabase
        .from('manager_targets')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('period_start', { ascending: false });

      if (metricFilter !== 'ALL') query = query.eq('metric', metricFilter);
      if (periodFilter === 'CURRENT') query = query.gte('period_end', monthStart);
      if (periodFilter === 'PAST') query = query.lt('period_end', monthStart);

      const { data, error } = await query;
      if (error) throw error;
      return (data as ManagerTargetRow[]) || [];
    },
    enabled: !!clinicId,
  });

  // Compute period range to fetch supporting data once
  const range = useMemo(() => {
    const list = targets || [];
    if (list.length === 0) return null;
    let min = list[0].period_start;
    let max = list[0].period_end;
    for (const t of list) {
      if (t.period_start < min) min = t.period_start;
      if (t.period_end > max) max = t.period_end;
    }
    return { min, max };
  }, [targets]);

  // KPI rows for actuals (REVENUE / APPOINTMENTS)
  const { data: kpiRows } = useQuery<KpiDailyRow[]>({
    queryKey: ['manager-kpi-for-targets', clinicId, range?.min, range?.max],
    queryFn: async () => {
      if (!clinicId || !range) return [];
      const { data, error } = await supabase
        .from('v_clinic_kpi_daily')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('day', range.min)
        .lte('day', range.max);
      if (error) throw error;
      return (data as KpiDailyRow[]) || [];
    },
    enabled: !!clinicId && !!range,
  });

  // Appointments for NEW_PATIENTS calc
  const { data: apptRows } = useQuery<AppointmentLite[]>({
    queryKey: ['manager-appts-for-targets', clinicId, range?.min, range?.max],
    queryFn: async () => {
      if (!clinicId || !range) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('id, clinic_id, patient_id, appointment_date')
        .eq('clinic_id', clinicId)
        .gte('appointment_date', range.min)
        .lte('appointment_date', range.max);
      if (error) throw error;
      return (data as AppointmentLite[]) || [];
    },
    enabled: !!clinicId && !!range,
  });

  // Compute actual_value for each target
  const enriched = useMemo(() => {
    return (targets || []).map((t) => {
      const start = t.period_start;
      const end = t.period_end;
      let actual = Number(t.actual_value || 0);
      if (t.metric === 'REVENUE') {
        actual = (kpiRows || [])
          .filter((r) => {
            const d = r.day?.slice(0, 10);
            return d >= start && d <= end;
          })
          .reduce((s, r) => s + Number(r.revenue || 0), 0);
      } else if (t.metric === 'APPOINTMENTS') {
        actual = (kpiRows || [])
          .filter((r) => {
            const d = r.day?.slice(0, 10);
            return d >= start && d <= end;
          })
          .reduce((s, r) => s + (r.appointments_count || 0), 0);
      } else if (t.metric === 'NEW_PATIENTS') {
        const set = new Set<string>();
        (apptRows || []).forEach((a) => {
          const d = a.appointment_date?.slice(0, 10);
          if (d && d >= start && d <= end && a.patient_id) set.add(a.patient_id);
        });
        actual = set.size;
      }
      return { ...t, computedActual: actual };
    });
  }, [targets, kpiRows, apptRows]);

  // Save (create or update)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error('Клиника не выбрана');
      const target = parseFloat(form.target_value.replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(target) || target <= 0) {
        throw new Error('Укажите корректное значение цели');
      }
      const payload: any = {
        clinic_id: clinicId,
        metric: form.metric,
        period_start: form.period_start,
        period_end: form.period_end,
        target_value: target,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase
          .from('manager_targets')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('manager_targets').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editing ? 'Цель обновлена' : 'Цель добавлена',
        description: 'Изменения сохранены',
      });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ['manager-targets'] });
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message ?? 'Не удалось сохранить цель',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('manager_targets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Цель удалена' });
      queryClient.invalidateQueries({ queryKey: ['manager-targets'] });
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message ?? 'Не удалось удалить',
        variant: 'destructive',
      });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (t: ManagerTargetRow) => {
    setEditing(t);
    setForm({
      metric: t.metric,
      period_start: t.period_start,
      period_end: t.period_end,
      target_value: String(t.target_value ?? ''),
      notes: t.notes || '',
    });
    setDialogOpen(true);
  };

  const progressColor = (pct: number) => {
    if (pct >= 100) return 'bg-emerald-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  if (!clinicId) {
    return (
      <ManagerLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TargetIcon className="w-5 h-5 text-primary" />
              </div>
              KPI / Цели
            </h1>
            <p className="text-muted-foreground mt-1">
              Ключевые показатели эффективности
            </p>
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
                <TargetIcon className="w-5 h-5 text-primary" />
              </div>
              KPI / Цели
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentClinic?.name} • Управление целями клиники
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Добавить цель
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Метрика</Label>
                <Select
                  value={metricFilter}
                  onValueChange={(v) => setMetricFilter(v as Metric | 'ALL')}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Все метрики</SelectItem>
                    {METRICS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Период</Label>
                <Select
                  value={periodFilter}
                  onValueChange={(v) => setPeriodFilter(v as any)}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CURRENT">Текущие и будущие</SelectItem>
                    <SelectItem value="PAST">Прошедшие</SelectItem>
                    <SelectItem value="ALL">Все</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Targets list */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TargetIcon className="w-5 h-5 text-primary" />
              Список целей
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !enriched || enriched.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="mb-3">Цели не найдены</p>
                <Button variant="outline" onClick={openCreate} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Создать первую цель
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Метрика</TableHead>
                    <TableHead>Период</TableHead>
                    <TableHead>План</TableHead>
                    <TableHead>Факт</TableHead>
                    <TableHead className="w-72">Прогресс</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enriched.map((t) => {
                    const target = Number(t.target_value || 0);
                    const actual = Number(t.computedActual || 0);
                    const pct = target > 0 ? (actual / target) * 100 : 0;
                    const display = Math.min(100, pct);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Badge variant="outline">{metricLabel(t.metric)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {t.period_start} — {t.period_end}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatTargetValue(t.metric, target)}
                        </TableCell>
                        <TableCell>{formatTargetValue(t.metric, actual)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={
                                  pct >= 100
                                    ? 'text-emerald-500 font-medium'
                                    : pct >= 70
                                      ? 'text-amber-500 font-medium'
                                      : 'text-rose-500 font-medium'
                                }
                              >
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className={`h-full transition-all ${progressColor(pct)}`}
                                style={{ width: `${display}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(t)}
                              title="Редактировать"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-rose-500 hover:text-rose-600"
                              onClick={() => deleteMutation.mutate(t.id)}
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

        {/* Add/edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Редактировать цель' : 'Новая цель'}</DialogTitle>
              <DialogDescription>
                Укажите метрику, период и плановое значение
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Метрика</Label>
                <Select
                  value={form.metric}
                  onValueChange={(v) => setForm({ ...form, metric: v as Metric })}
                  disabled={!!editing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Начало</Label>
                  <Input
                    type="date"
                    value={form.period_start}
                    onChange={(e) =>
                      setForm({ ...form, period_start: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Конец</Label>
                  <Input
                    type="date"
                    value={form.period_end}
                    onChange={(e) =>
                      setForm({ ...form, period_end: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Плановое значение</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.target_value}
                  onChange={(e) =>
                    setForm({ ...form, target_value: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Заметки</Label>
                <Textarea
                  placeholder="Описание цели (опционально)"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saveMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ManagerLayout>
  );
}
