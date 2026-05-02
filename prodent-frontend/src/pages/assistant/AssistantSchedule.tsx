import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AssistantLayout } from '@/components/assistant/AssistantLayout';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  Home,
  StickyNote,
  CalendarX,
} from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Assignment {
  id: string;
  clinic_id: string;
  assistant_id: string;
  doctor_id: string;
  room_id: string | null;
  shift_date: string;
  shift_start: string | null;
  shift_end: string | null;
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
}

interface RoomRow {
  id: string;
  name: string;
  room_number: string | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PLANNED: { label: 'Запланирована', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  ACTIVE: { label: 'Активна', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  DONE: { label: 'Завершена', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
  CANCELLED: { label: 'Отменена', className: 'bg-red-100 text-red-700 border-red-200' },
};

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = format(d, 'yyyy-MM');
    const label = format(d, 'LLLL yyyy', { locale: ru });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

export default function AssistantSchedule() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const {
    data: assignments,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['assistant-schedule', currentClinic?.id, user?.id],
    queryFn: async () => {
      if (!currentClinic?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from('assistant_assignments')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('assistant_id', user.id)
        .order('shift_date', { ascending: false });

      if (error) {
        toast({
          title: 'Не удалось загрузить расписание',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }
      return (data ?? []) as Assignment[];
    },
    enabled: !!currentClinic?.id && !!user,
  });

  const doctorIds = useMemo(
    () => Array.from(new Set((assignments ?? []).map((a) => a.doctor_id))).filter(Boolean),
    [assignments],
  );
  const roomIds = useMemo(
    () => Array.from(new Set((assignments ?? []).map((a) => a.room_id).filter(Boolean) as string[])),
    [assignments],
  );

  const { data: doctors } = useQuery({
    queryKey: ['assistant-schedule-doctors', currentClinic?.id, doctorIds.join(',')],
    queryFn: async () => {
      if (doctorIds.length === 0) return [] as DoctorRow[];
      const { data } = await supabase
        .from('doctors')
        .select('id, user_id')
        .in('id', doctorIds);
      return (data ?? []) as DoctorRow[];
    },
    enabled: !!currentClinic?.id && doctorIds.length > 0,
  });

  const doctorUserIds = useMemo(() => (doctors ?? []).map((d) => d.user_id), [doctors]);

  const { data: doctorProfiles } = useQuery({
    queryKey: ['assistant-schedule-doctor-profiles', doctorUserIds.join(',')],
    queryFn: async () => {
      if (doctorUserIds.length === 0) return [] as ProfileRow[];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', doctorUserIds);
      return (data ?? []) as ProfileRow[];
    },
    enabled: doctorUserIds.length > 0,
  });

  const { data: rooms } = useQuery({
    queryKey: ['assistant-schedule-rooms', currentClinic?.id, roomIds.join(',')],
    queryFn: async () => {
      if (roomIds.length === 0) return [] as RoomRow[];
      const { data } = await supabase
        .from('rooms')
        .select('id, name, room_number')
        .in('id', roomIds);
      return (data ?? []) as RoomRow[];
    },
    enabled: roomIds.length > 0,
  });

  const doctorNameById = useMemo(() => {
    const map = new Map<string, string>();
    (doctors ?? []).forEach((d) => {
      const profile = (doctorProfiles ?? []).find((p) => p.id === d.user_id);
      map.set(d.id, profile?.full_name ?? 'Врач');
    });
    return map;
  }, [doctors, doctorProfiles]);

  const roomById = useMemo(() => {
    const map = new Map<string, RoomRow>();
    (rooms ?? []).forEach((r) => map.set(r.id, r));
    return map;
  }, [rooms]);

  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    if (monthFilter === 'all') return assignments;
    return assignments.filter((a) => a.shift_date?.startsWith(monthFilter));
  }, [assignments, monthFilter]);

  // Group by ISO week start (Monday)
  const groupedByWeek = useMemo(() => {
    const groups = new Map<string, { weekStart: Date; weekEnd: Date; items: Assignment[] }>();
    filteredAssignments.forEach((a) => {
      if (!a.shift_date) return;
      const d = parseISO(a.shift_date);
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
      const key = format(weekStart, 'yyyy-MM-dd');
      if (!groups.has(key)) {
        groups.set(key, { weekStart, weekEnd, items: [] });
      }
      groups.get(key)!.items.push(a);
    });
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredAssignments]);

  return (
    <AssistantLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-primary" />
              Расписание
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentClinic
                ? `${currentClinic.name} • ${filteredAssignments.length} смен`
                : 'Выберите клинику'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Месяц" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все месяцы</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {monthFilter !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => setMonthFilter('all')}>
                Сбросить
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Не удалось загрузить расписание. Попробуйте обновить страницу.
            </CardContent>
          </Card>
        ) : groupedByWeek.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CalendarX className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                Смены не найдены
              </h3>
              <p className="text-sm text-muted-foreground">
                {monthFilter === 'all'
                  ? 'Расписание ещё не сформировано.'
                  : 'В выбранном месяце нет назначений.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedByWeek.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span>
                    Неделя: {format(group.weekStart, 'd MMM', { locale: ru })} —{' '}
                    {format(group.weekEnd, 'd MMM yyyy', { locale: ru })}
                  </span>
                  <Badge variant="secondary">{group.items.length}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.items.map((a) => {
                    const status = STATUS_LABELS[a.status] ?? {
                      label: a.status,
                      className: 'bg-neutral-100 text-neutral-600 border-neutral-200',
                    };
                    const room = a.room_id ? roomById.get(a.room_id) : undefined;
                    return (
                      <Card key={a.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base">
                              {format(parseISO(a.shift_date), 'EEEE, d MMM', { locale: ru })}
                            </CardTitle>
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>
                              {a.shift_start?.slice(0, 5) ?? '--:--'} —{' '}
                              {a.shift_end?.slice(0, 5) ?? '--:--'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">
                              {doctorNameById.get(a.doctor_id) ?? 'Врач'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">
                              {room
                                ? `${room.name}${room.room_number ? ` • №${room.room_number}` : ''}`
                                : 'Кабинет не назначен'}
                            </span>
                          </div>
                          {a.notes && (
                            <div className="flex items-start gap-2 pt-1 text-muted-foreground">
                              <StickyNote className="w-4 h-4 mt-0.5 shrink-0" />
                              <span className="line-clamp-3">{a.notes}</span>
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
    </AssistantLayout>
  );
}
