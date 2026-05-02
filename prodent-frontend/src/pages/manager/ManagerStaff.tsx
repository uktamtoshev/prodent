import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { ManagerLayout } from '@/components/manager/ManagerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  Trophy,
  Inbox,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  Medal,
} from 'lucide-react';

interface DoctorAffiliationRow {
  doctor_id: string;
  is_active: boolean;
  doctors?: {
    id: string;
    user_id?: string | null;
    specialty?: string | null;
    rating?: number | null;
    profiles?: {
      full_name?: string | null;
      avatar_url?: string | null;
    } | null;
  } | null;
}

interface DoctorPerformanceRow {
  doctor_id: string;
  clinic_id: string;
  month: string;
  appointments_count: number;
  completed_count: number;
  no_show_count: number;
  revenue: number;
  avg_rating: number;
}

interface StaffRow {
  doctor_id: string;
  name: string;
  specialty: string;
  avatar?: string | null;
  appointments: number;
  completed: number;
  noShow: number;
  noShowRate: number;
  revenue: number;
  avgRating: number;
}

type SortKey = 'name' | 'appointments' | 'revenue' | 'noShowRate' | 'avgRating';

const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} UZS`;

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const initials = (name?: string) => {
  if (!name) return '??';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
};

export default function ManagerStaff() {
  const { currentClinic } = useClinic();
  const clinicId = currentClinic?.id;

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(
    () => ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
    [today],
  );
  const monthEnd = useMemo(
    () => ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    [today],
  );

  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Doctors at clinic
  const { data: doctors, isLoading: doctorsLoading } = useQuery<DoctorAffiliationRow[]>({
    queryKey: ['manager-staff-doctors', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from('doctor_clinic_affiliations')
        .select(
          `
          doctor_id,
          is_active,
          doctors:doctor_id (
            id,
            user_id,
            specialty,
            rating,
            profiles:user_id (
              full_name,
              avatar_url
            )
          )
        `,
        )
        .eq('clinic_id', clinicId)
        .eq('is_active', true);
      if (error) throw error;
      return (data as DoctorAffiliationRow[]) || [];
    },
    enabled: !!clinicId,
  });

  // Performance for this month
  const { data: performance, isLoading: perfLoading } = useQuery<
    DoctorPerformanceRow[]
  >({
    queryKey: ['manager-staff-performance', clinicId, monthStart],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from('v_doctor_performance')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('month', monthStart)
        .lte('month', monthEnd);
      if (error) throw error;
      return (data as DoctorPerformanceRow[]) || [];
    },
    enabled: !!clinicId,
  });

  const rows: StaffRow[] = useMemo(() => {
    const perfMap = new Map<string, DoctorPerformanceRow>();
    (performance || []).forEach((p) => perfMap.set(p.doctor_id, p));

    return (doctors || [])
      .filter((d) => !!d.doctors?.id)
      .map((d) => {
        const doctorId = d.doctors!.id;
        const p = perfMap.get(doctorId);
        const appointments = p?.appointments_count || 0;
        const noShow = p?.no_show_count || 0;
        const noShowRate = appointments > 0 ? (noShow / appointments) * 100 : 0;
        return {
          doctor_id: doctorId,
          name: d.doctors?.profiles?.full_name || 'Без имени',
          specialty: d.doctors?.specialty || '—',
          avatar: d.doctors?.profiles?.avatar_url || null,
          appointments,
          completed: p?.completed_count || 0,
          noShow,
          noShowRate,
          revenue: Number(p?.revenue || 0),
          avgRating: Number(p?.avg_rating ?? d.doctors?.rating ?? 0),
        };
      });
  }, [doctors, performance]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (sortKey === 'name') {
        av = (av as string).toLowerCase();
        bv = (bv as string).toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      }
      const an = Number(av || 0);
      const bn = Number(bv || 0);
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const top3 = useMemo(() => {
    return [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  }, [rows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5" />
    );
  };

  const podiumStyles = [
    {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-500',
      icon: 'text-amber-500',
      title: '1 место',
    },
    {
      bg: 'bg-slate-400/10',
      border: 'border-slate-400/30',
      text: 'text-slate-300',
      icon: 'text-slate-400',
      title: '2 место',
    },
    {
      bg: 'bg-orange-700/10',
      border: 'border-orange-700/30',
      text: 'text-orange-500',
      icon: 'text-orange-600',
      title: '3 место',
    },
  ];

  if (!clinicId) {
    return (
      <ManagerLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              Управление персоналом
            </h1>
            <p className="text-muted-foreground mt-1">Производительность сотрудников клиники</p>
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

  const isLoading = doctorsLoading || perfLoading;

  return (
    <ManagerLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            Управление персоналом
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentClinic?.name} • Показатели за текущий месяц
          </p>
        </div>

        {/* Top 3 podium */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Топ-3 врача месяца (по выручке)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : top3.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
                Нет данных за текущий месяц
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3.map((r, idx) => {
                  const s = podiumStyles[idx];
                  return (
                    <div
                      key={r.doctor_id}
                      className={`p-4 rounded-xl border ${s.bg} ${s.border} flex items-center gap-3`}
                    >
                      <div className="relative">
                        <Avatar className="w-14 h-14">
                          <AvatarImage src={r.avatar || undefined} />
                          <AvatarFallback>{initials(r.name)}</AvatarFallback>
                        </Avatar>
                        <Medal
                          className={`absolute -top-1 -right-1 w-5 h-5 ${s.icon}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold ${s.text}`}>
                          {s.title}
                        </div>
                        <p className="font-medium text-foreground truncate">
                          {r.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.specialty}
                        </p>
                        <p className="text-sm font-semibold text-foreground mt-1">
                          {formatMoney(r.revenue)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff table */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Все врачи клиники
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>В клинике нет активных врачей</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          onClick={() => toggleSort('name')}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Врач <SortIcon k="name" />
                        </button>
                      </TableHead>
                      <TableHead>Специальности</TableHead>
                      <TableHead>
                        <button
                          onClick={() => toggleSort('appointments')}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Записи <SortIcon k="appointments" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => toggleSort('revenue')}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Выручка <SortIcon k="revenue" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => toggleSort('noShowRate')}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Неявки % <SortIcon k="noShowRate" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => toggleSort('avgRating')}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Рейтинг <SortIcon k="avgRating" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((r) => (
                      <TableRow key={r.doctor_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              <AvatarImage src={r.avatar || undefined} />
                              <AvatarFallback>{initials(r.name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">
                              {r.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.specialty}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {r.appointments.toLocaleString('ru-RU')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              завершено: {r.completed}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatMoney(r.revenue)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              r.noShowRate > 20
                                ? 'text-rose-500 font-medium'
                                : r.noShowRate > 10
                                  ? 'text-amber-500 font-medium'
                                  : 'text-emerald-500 font-medium'
                            }
                          >
                            {r.noShowRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            {r.avgRating > 0 ? r.avgRating.toFixed(1) : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}
