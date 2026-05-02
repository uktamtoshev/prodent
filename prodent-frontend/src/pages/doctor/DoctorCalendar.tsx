import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, Clock, User, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Ожидает', variant: 'outline' },
  CONFIRMED: { label: 'Подтверждена', variant: 'secondary' },
  IN_PROGRESS: { label: 'В работе', variant: 'default' },
  COMPLETED: { label: 'Выполнена', variant: 'default' },
  CANCELLED: { label: 'Отменена', variant: 'destructive' },
  NO_SHOW: { label: 'Не пришёл', variant: 'destructive' },
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0..Sun=6
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function DoctorCalendar() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: doctor } = useQuery({
    queryKey: ['doctor-by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const weekEnd = addDays(weekStart, 6);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['doctor-calendar', doctor?.id, ymd(weekStart), statusFilter],
    queryFn: async () => {
      if (!doctor?.id) return [] as any[];
      let query = supabase
        .from('appointments')
        .select('*, patient:users!appointments_patient_id_fkey(id, first_name, last_name, phone), service:services(id, name, duration_minutes), clinic:clinics(id, name)')
        .eq('doctor_id', doctor.id)
        .gte('appointment_date', ymd(weekStart))
        .lte('appointment_date', ymd(weekEnd))
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!doctor?.id,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (let i = 0; i < 7; i++) {
      map.set(ymd(addDays(weekStart, i)), []);
    }
    (appointments || []).forEach((a: any) => {
      const k = a.appointment_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    });
    return map;
  }, [appointments, weekStart]);

  const totalCount = appointments?.length ?? 0;
  const completedCount = appointments?.filter((a: any) => a.status === 'COMPLETED').length ?? 0;

  return (
    <DoctorLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              Календарь записей
            </h1>
            <p className="text-muted-foreground">
              {weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              {' — '}
              {weekEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Сегодня
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Всего на неделе</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Выполнено</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{completedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Осталось</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalCount - completedCount}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : !doctor ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Профиль врача не найден.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, idx) => {
              const day = addDays(weekStart, idx);
              const key = ymd(day);
              const items = grouped.get(key) || [];
              const isToday = ymd(new Date()) === key;
              return (
                <Card key={key} className={isToday ? 'border-primary' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{WEEKDAYS[idx]}</span>
                      <span className={isToday ? 'text-primary font-bold' : 'text-muted-foreground'}>
                        {day.getDate()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 pb-3">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Нет записей</p>
                    ) : (
                      items.map((a: any) => {
                        const st = STATUS_LABELS[a.status] || STATUS_LABELS.PENDING;
                        return (
                          <div
                            key={a.id}
                            className="rounded-md border bg-card p-2 text-xs space-y-1 hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center gap-1 font-semibold">
                              <Clock className="w-3 h-3" />
                              {a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="truncate">
                                {a.patient?.first_name} {a.patient?.last_name}
                              </span>
                            </div>
                            {a.service?.name && (
                              <div className="text-muted-foreground truncate">
                                {a.service.name}
                              </div>
                            )}
                            {a.clinic?.name && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{a.clinic.name}</span>
                              </div>
                            )}
                            <Badge variant={st.variant} className="text-[10px]">
                              {st.label}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
