import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, isYesterday, isTomorrow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Stethoscope,
  Filter,
  X,
  CalendarDays,
} from 'lucide-react';

import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AppointmentRow {
  id: string;
  clinic_id: string;
  doctor_id: string | null;
  patient_id: string | null;
  appointment_date: string;
  service: string | null;
  status: string;
  price: number | null;
  notes: string | null;
  doctor?: { id: string; user_id?: string; profiles?: { full_name?: string | null } | null } | null;
  patient?: { id: string; full_name?: string | null; phone?: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждена',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  NO_SHOW: 'Не пришёл',
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  CONFIRMED: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  COMPLETED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  NO_SHOW: 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30',
};

function statusKey(s: string): string {
  return (s || '').toUpperCase();
}

function statusBadgeClass(s: string): string {
  return STATUS_STYLES[statusKey(s)] || 'bg-muted text-muted-foreground border-border';
}

function statusLabel(s: string): string {
  return STATUS_LABELS[statusKey(s)] || STATUS_LABELS[s] || s || '—';
}

function formatDateGroup(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Сегодня';
  if (isTomorrow(d)) return 'Завтра';
  if (isYesterday(d)) return 'Вчера';
  return format(d, 'd MMMM yyyy, EEEE', { locale: ru });
}

export default function ClinicAdminSchedule() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const clinicId = currentClinic?.id;

  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const { data: doctors } = useQuery({
    queryKey: ['clinic-admin-schedule-doctors', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, user_id, profiles:user_id(full_name)')
        .eq('clinic_id', clinicId);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!clinicId,
  });

  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ['clinic-admin-schedule', clinicId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          id,
          clinic_id,
          doctor_id,
          patient_id,
          appointment_date,
          service,
          status,
          price,
          notes,
          doctor:doctors!appointments_doctor_id_fkey(id, user_id, profiles:user_id(full_name)),
          patient:profiles!appointments_patient_id_fkey(id, full_name, phone)
        `)
        .eq('clinic_id', clinicId)
        .order('appointment_date', { ascending: true });

      if (dateFrom) query = query.gte('appointment_date', new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('appointment_date', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as AppointmentRow[];
    },
    enabled: !!clinicId,
  });

  if (error) {
    toast({
      title: 'Ошибка',
      description: 'Не удалось загрузить расписание',
      variant: 'destructive',
    });
  }

  const filtered = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => {
      if (doctorFilter !== 'all' && a.doctor_id !== doctorFilter) return false;
      if (statusFilter !== 'all' && statusKey(a.status) !== statusFilter) return false;
      return true;
    });
  }, [appointments, doctorFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    filtered.forEach((a) => {
      const key = format(parseISO(a.appointment_date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const hasFilters =
    doctorFilter !== 'all' || statusFilter !== 'all' || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setDoctorFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <ClinicAdminLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              Расписание
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentClinic ? currentClinic.name : 'Выберите клинику'} • {filtered.length} записей
            </p>
          </div>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Stethoscope className="w-3 h-3" /> Врач
              </Label>
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger><SelectValue placeholder="Все врачи" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все врачи</SelectItem>
                  {(doctors || []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.profiles?.full_name || 'Без имени'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="w-3 h-3" /> Статус
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Все статусы" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="PENDING">Ожидает</SelectItem>
                  <SelectItem value="CONFIRMED">Подтверждена</SelectItem>
                  <SelectItem value="COMPLETED">Завершена</SelectItem>
                  <SelectItem value="CANCELLED">Отменена</SelectItem>
                  <SelectItem value="NO_SHOW">Не пришёл</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Дата с</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Дата по</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div className="flex items-end">
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2 w-full">
                  <X className="w-4 h-4" /> Сбросить
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CalendarDays className="w-8 h-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Нет записей</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {hasFilters
                  ? 'Попробуйте изменить фильтры или сбросьте их.'
                  : 'Записи появятся здесь после того, как пациенты забронируют визит.'}
              </p>
              {hasFilters && (
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={clearFilters}>
                  <X className="w-4 h-4" /> Сбросить фильтры
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([dayKey, items]) => (
              <div key={dayKey} className="space-y-3">
                <div className="flex items-center gap-2 sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {formatDateGroup(items[0].appointment_date)}
                  </h3>
                  <Badge variant="outline" className="text-xs">{items.length}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map((a) => {
                    const time = format(parseISO(a.appointment_date), 'HH:mm');
                    const docName = a.doctor?.profiles?.full_name || 'Не назначен';
                    const patName = a.patient?.full_name || 'Гость';
                    return (
                      <Card key={a.id} className="border-border/50 hover:shadow-md transition-shadow">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Clock className="w-4 h-4 text-primary" />
                              {time}
                            </div>
                            <Badge variant="outline" className={statusBadgeClass(a.status)}>
                              {statusLabel(a.status)}
                            </Badge>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <UserIcon className="w-4 h-4 text-muted-foreground" />
                              {patName}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Stethoscope className="w-4 h-4" />
                              {docName}
                            </div>
                            {a.service && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{a.service}</p>
                            )}
                          </div>
                          {a.price != null && (
                            <div className="text-sm font-semibold text-foreground">
                              {Number(a.price).toLocaleString('ru-RU')} UZS
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ClinicAdminLayout>
  );
}
