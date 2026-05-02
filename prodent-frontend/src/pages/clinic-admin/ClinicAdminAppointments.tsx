import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  CheckCircle2,
  XCircle,
  Filter,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  X,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Appointment {
  id: string;
  clinic_id: string;
  doctor_id: string | null;
  patient_id: string | null;
  appointment_date: string;
  service: string | null;
  status: string;
  price: number | null;
  doctor?: { id: string; user_id?: string; profiles?: { full_name?: string | null } | null } | null;
  patient?: { id: string; full_name?: string | null; phone?: string | null } | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'PENDING', label: 'Ожидает' },
  { value: 'CONFIRMED', label: 'Подтверждена' },
  { value: 'COMPLETED', label: 'Завершена' },
  { value: 'CANCELLED', label: 'Отменена' },
  { value: 'NO_SHOW', label: 'Не пришёл' },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждена',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  NO_SHOW: 'Не пришёл',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  CONFIRMED: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  COMPLETED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  NO_SHOW: 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30',
};

const PAGE_SIZE = 15;

export default function ClinicAdminAppointments() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = currentClinic?.id;

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: doctors } = useQuery({
    queryKey: ['clinic-admin-appointments-doctors', clinicId],
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

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['clinic-admin-appointments', clinicId, dateFrom, dateTo],
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
          doctor:doctors!appointments_doctor_id_fkey(id, user_id, profiles:user_id(full_name)),
          patient:profiles!appointments_patient_id_fkey(id, full_name, phone)
        `)
        .eq('clinic_id', clinicId)
        .order('appointment_date', { ascending: false });

      if (dateFrom) query = query.gte('appointment_date', new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('appointment_date', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as Appointment[];
    },
    enabled: !!clinicId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => {
      toast({
        title: 'Запись обновлена',
        description: vars.status === 'CONFIRMED'
          ? 'Запись подтверждена'
          : vars.status === 'CANCELLED'
            ? 'Запись отменена'
            : 'Статус изменён',
      });
      queryClient.invalidateQueries({ queryKey: ['clinic-admin-appointments', clinicId] });
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message || 'Не удалось обновить запись',
        variant: 'destructive',
      });
    },
  });

  const filtered = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => {
      if (statusFilter !== 'all' && (a.status || '').toUpperCase() !== statusFilter) return false;
      if (doctorFilter !== 'all' && a.doctor_id !== doctorFilter) return false;
      return true;
    });
  }, [appointments, statusFilter, doctorFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = statusFilter !== 'all' || doctorFilter !== 'all' || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setStatusFilter('all');
    setDoctorFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <ClinicAdminLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-primary" />
              Записи
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
                <Filter className="w-3 h-3" /> Статус
              </Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Врач</Label>
              <Select value={doctorFilter} onValueChange={(v) => { setDoctorFilter(v); setPage(1); }}>
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
              <Label className="text-xs text-muted-foreground">С даты</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">По дату</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
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
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ListChecks className="w-8 h-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Нет записей</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {hasFilters
                  ? 'Попробуйте изменить фильтры или сбросьте их.'
                  : 'Записи пациентов появятся здесь, когда они забронируют визит.'}
              </p>
              {hasFilters && (
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={clearFilters}>
                  <X className="w-4 h-4" /> Сбросить
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Время</TableHead>
                    <TableHead>Пациент</TableHead>
                    <TableHead>Врач</TableHead>
                    <TableHead>Услуга</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((a) => {
                    const dt = parseISO(a.appointment_date);
                    const stKey = (a.status || '').toUpperCase();
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(dt, 'd MMM yyyy', { locale: ru })}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{format(dt, 'HH:mm')}</TableCell>
                        <TableCell>
                          <div className="font-medium">{a.patient?.full_name || 'Гость'}</div>
                          {a.patient?.phone && (
                            <div className="text-xs text-muted-foreground">{a.patient.phone}</div>
                          )}
                        </TableCell>
                        <TableCell>{a.doctor?.profiles?.full_name || '—'}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="line-clamp-1 text-sm">{a.service || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLES[stKey] || ''}>
                            {STATUS_LABELS[stKey] || a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {a.price != null ? `${Number(a.price).toLocaleString('ru-RU')} UZS` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {stKey !== 'CONFIRMED' && stKey !== 'COMPLETED' && stKey !== 'CANCELLED' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700"
                                disabled={updateStatusMutation.isPending}
                                onClick={() => updateStatusMutation.mutate({ id: a.id, status: 'CONFIRMED' })}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Подтвердить
                              </Button>
                            )}
                            {stKey !== 'CANCELLED' && stKey !== 'COMPLETED' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                disabled={updateStatusMutation.isPending}
                                onClick={() => updateStatusMutation.mutate({ id: a.id, status: 'CANCELLED' })}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Отменить
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Страница {safePage} из {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Назад
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="gap-1"
              >
                Далее <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </ClinicAdminLayout>
  );
}
