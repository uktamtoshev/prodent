import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssistantLayout } from '@/components/assistant/AssistantLayout';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Users,
  Clock,
  CheckCircle2,
  PlayCircle,
  CalendarX,
  Search,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Appointment {
  id: string;
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string | null;
  end_time: string | null;
  service: string | null;
  status: string;
  notes: string | null;
}

interface DoctorRow {
  id: string;
  user_id: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Ожидание', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  CONFIRMED: { label: 'Подтверждено', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  IN_PROGRESS: { label: 'В процессе', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  COMPLETED: { label: 'Завершено', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Отменено', className: 'bg-red-100 text-red-700 border-red-200' },
  NO_SHOW: { label: 'Не явился', className: 'bg-neutral-200 text-neutral-700 border-neutral-300' },
};

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function AssistantAppointments() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scope, setScope] = useState<'today' | 'upcoming'>('today');

  const today = todayIso();

  // 1. Active assignments for assistant (today and forward) — to find which doctors to follow
  const { data: assignments } = useQuery({
    queryKey: ['assistant-appointments-assignments', currentClinic?.id, user?.id, today],
    queryFn: async () => {
      if (!currentClinic?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from('assistant_assignments')
        .select('id, doctor_id, shift_date, status')
        .eq('clinic_id', currentClinic.id)
        .eq('assistant_id', user.id)
        .gte('shift_date', today);
      if (error) throw error;
      return (data ?? []) as { id: string; doctor_id: string; shift_date: string; status: string }[];
    },
    enabled: !!currentClinic?.id && !!user,
  });

  const doctorIds = useMemo(
    () => Array.from(new Set((assignments ?? []).map((a) => a.doctor_id))).filter(Boolean),
    [assignments],
  );

  // 2. Appointments for those doctors today/forward
  const {
    data: appointments,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['assistant-appointments', currentClinic?.id, user?.id, doctorIds.join(','), scope, today],
    queryFn: async () => {
      if (!currentClinic?.id || doctorIds.length === 0) return [] as Appointment[];

      let q = supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .in('doctor_id', doctorIds);

      if (scope === 'today') {
        q = q.eq('appointment_date', today);
      } else {
        q = q.gte('appointment_date', today);
      }

      q = q.order('appointment_date', { ascending: true }).order('start_time', { ascending: true });

      const { data, error } = await q;
      if (error) {
        toast({
          title: 'Ошибка загрузки приёмов',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }
      return (data ?? []) as Appointment[];
    },
    enabled: !!currentClinic?.id && !!user && doctorIds.length > 0,
  });

  const patientIds = useMemo(
    () => Array.from(new Set((appointments ?? []).map((a) => a.patient_id))).filter(Boolean),
    [appointments],
  );

  const { data: doctors } = useQuery({
    queryKey: ['assistant-appointments-doctors', doctorIds.join(',')],
    queryFn: async () => {
      if (doctorIds.length === 0) return [] as DoctorRow[];
      const { data } = await supabase
        .from('doctors')
        .select('id, user_id')
        .in('id', doctorIds);
      return (data ?? []) as DoctorRow[];
    },
    enabled: doctorIds.length > 0,
  });

  const profileIds = useMemo(() => {
    const ids = new Set<string>(patientIds);
    (doctors ?? []).forEach((d) => ids.add(d.user_id));
    return Array.from(ids);
  }, [patientIds, doctors]);

  const { data: profiles } = useQuery({
    queryKey: ['assistant-appointments-profiles', profileIds.join(',')],
    queryFn: async () => {
      if (profileIds.length === 0) return [] as ProfileRow[];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', profileIds);
      return (data ?? []) as ProfileRow[];
    },
    enabled: profileIds.length > 0,
  });

  const profileById = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    (profiles ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const doctorNameById = useMemo(() => {
    const map = new Map<string, string>();
    (doctors ?? []).forEach((d) => {
      const profile = profileById.get(d.user_id);
      map.set(d.id, profile?.full_name ?? 'Врач');
    });
    return map;
  }, [doctors, profileById]);

  // Filtering by search/status
  const visibleAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const patient = profileById.get(a.patient_id);
        const doctorName = doctorNameById.get(a.doctor_id) ?? '';
        const matches =
          patient?.full_name?.toLowerCase().includes(q) ||
          patient?.phone?.toLowerCase().includes(q) ||
          a.service?.toLowerCase().includes(q) ||
          doctorName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [appointments, search, statusFilter, profileById, doctorNameById]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ status }) => {
      toast({
        title: 'Статус обновлён',
        description:
          status === 'IN_PROGRESS'
            ? 'Пациент отмечен как пришедший'
            : status === 'COMPLETED'
              ? 'Процедура завершена'
              : `Новый статус: ${status}`,
      });
      queryClient.invalidateQueries({ queryKey: ['assistant-appointments'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Не удалось обновить статус',
        description: err?.message ?? 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    },
  });

  return (
    <AssistantLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Сопровождение приёмов
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentClinic
                ? `${currentClinic.name} • ${visibleAppointments.length} приёмов`
                : 'Выберите клинику'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={scope} onValueChange={(v) => setScope(v as 'today' | 'upcoming')}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="upcoming">Предстоящие</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по пациенту, услуге, врачу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Не удалось загрузить приёмы.
            </CardContent>
          </Card>
        ) : doctorIds.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CalendarX className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                Нет назначенных врачей
              </h3>
              <p className="text-sm text-muted-foreground">
                У вас пока нет смен с врачами на сегодня или на будущее.
              </p>
            </CardContent>
          </Card>
        ) : visibleAppointments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CalendarX className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                Приёмов не найдено
              </h3>
              <p className="text-sm text-muted-foreground">
                Попробуйте изменить фильтры или диапазон.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Дата / время</TableHead>
                  <TableHead>Пациент</TableHead>
                  <TableHead>Услуга</TableHead>
                  <TableHead>Врач</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAppointments.map((a) => {
                  const patient = profileById.get(a.patient_id);
                  const doctorName = doctorNameById.get(a.doctor_id) ?? 'Врач';
                  const meta = STATUS_META[a.status] ?? {
                    label: a.status,
                    className: 'bg-neutral-100 text-neutral-700 border-neutral-200',
                  };

                  const canStart = a.status === 'PENDING' || a.status === 'CONFIRMED';
                  const canComplete = a.status === 'IN_PROGRESS';

                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">
                          {format(parseISO(a.appointment_date), 'd MMM', { locale: ru })}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {a.start_time?.slice(0, 5) ?? '--:--'}
                          {a.end_time ? ` — ${a.end_time.slice(0, 5)}` : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {patient?.full_name ?? 'Пациент'}
                        </div>
                        {patient?.phone && (
                          <div className="text-xs text-muted-foreground">
                            {patient.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <span className="line-clamp-2 text-sm">
                          {a.service ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{doctorName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canStart || updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: a.id,
                                status: 'IN_PROGRESS',
                              })
                            }
                          >
                            <PlayCircle className="w-4 h-4 mr-1" />
                            Пациент пришёл
                          </Button>
                          <Button
                            size="sm"
                            disabled={!canComplete || updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: a.id,
                                status: 'COMPLETED',
                              })
                            }
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Завершено
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AssistantLayout>
  );
}
