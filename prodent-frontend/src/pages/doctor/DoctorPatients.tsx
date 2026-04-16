import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Users,
  ShieldCheck,
  Clock,
  ShieldX,
  Phone,
  Calendar,
  ChevronRight,
  FileHeart,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type AccessStatus = 'all' | 'approved' | 'pending' | 'none';

export default function DoctorPatients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState<AccessStatus>('all');

  // Получаем doctorId по user_id
  const { data: doctor } = useQuery({
    queryKey: ['current-doctor', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Получаем всех пациентов врача (по записям)
  const { data: patients, isLoading } = useQuery({
    queryKey: ['doctor-patients', doctor?.id],
    queryFn: async () => {
      // Получаем уникальных пациентов из записей врача
      const { data: appointments } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('doctor_id', doctor!.id);

      const uniquePatientIds = [...new Set(appointments?.map(a => a.patient_id) || [])];

      if (uniquePatientIds.length === 0) return [];

      // Получаем профили пациентов
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', uniquePatientIds);

      return profiles || [];
    },
    enabled: !!doctor?.id,
  });

  // Получаем статусы доступа к медкартам
  const { data: accessRequests } = useQuery({
    queryKey: ['medical-access-requests', doctor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_access_requests')
        .select('*')
        .eq('doctor_id', doctor!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!doctor?.id,
  });

  // Получаем статистику записей для каждого пациента
  const { data: appointmentStats } = useQuery({
    queryKey: ['patient-appointment-stats', doctor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('patient_id, appointment_date')
        .eq('doctor_id', doctor!.id);

      const stats: Record<string, { count: number; lastVisit: string }> = {};
      data?.forEach(apt => {
        if (!stats[apt.patient_id]) {
          stats[apt.patient_id] = { count: 0, lastVisit: apt.appointment_date };
        }
        stats[apt.patient_id].count++;
        if (apt.appointment_date > stats[apt.patient_id].lastVisit) {
          stats[apt.patient_id].lastVisit = apt.appointment_date;
        }
      });
      return stats;
    },
    enabled: !!doctor?.id,
  });

  // Функция получения статуса доступа для пациента
  const getAccessStatus = (patientId: string) => {
    const request = accessRequests?.find(
      r => r.patient_id === patientId && r.status !== 'rejected'
    );
    if (!request) return 'none';
    if (request.status === 'approved' && request.patient_consent) return 'approved';
    if (request.status === 'pending') return 'pending';
    if (request.status === 'approved' && !request.patient_consent) return 'pending';
    return 'none';
  };

  // Фильтрация пациентов
  const filteredPatients = useMemo(() => {
    if (!patients) return [];

    return patients.filter(patient => {
      // Поиск
      const searchMatch = !searchQuery ||
        patient.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone?.includes(searchQuery);

      // Фильтр по доступу
      const status = getAccessStatus(patient.id);
      const accessMatch = accessFilter === 'all' || status === accessFilter;

      return searchMatch && accessMatch;
    });
  }, [patients, searchQuery, accessFilter, accessRequests]);

  // Подсчёт по статусам
  const statusCounts = useMemo(() => {
    const counts = { all: 0, approved: 0, pending: 0, none: 0 };
    patients?.forEach(patient => {
      counts.all++;
      const status = getAccessStatus(patient.id);
      counts[status as keyof typeof counts]++;
    });
    return counts;
  }, [patients, accessRequests]);

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handlePatientClick = (patientId: string) => {
    navigate(`/doctor/patients/${patientId}`);
  };

  return (
    <DoctorLayout>
      <div className="p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Мои пациенты</h1>
            <p className="text-muted-foreground">
              Управление пациентами и доступом к медкартам
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{patients?.length || 0} пациентов</span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={accessFilter} onValueChange={(v) => setAccessFilter(v as AccessStatus)}>
            <TabsList>
              <TabsTrigger value="all" className="gap-1.5">
                Все
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Открыт
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.approved}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Ожидает
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="none" className="gap-1.5">
                <ShieldX className="h-3.5 w-3.5 text-muted-foreground" />
                Нет
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.none}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Patients List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPatients.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">Пациенты не найдены</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery || accessFilter !== 'all'
                  ? 'Попробуйте изменить параметры поиска'
                  : 'Пациенты появятся после первых записей к вам'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map(patient => {
              const status = getAccessStatus(patient.id);
              const stats = appointmentStats?.[patient.id];

              return (
                <Card
                  key={patient.id}
                  className="group cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handlePatientClick(patient.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={patient.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {getInitials(patient.full_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{patient.full_name || 'Без имени'}</h3>
                          {status === 'approved' && (
                            <Badge variant="outline" className="shrink-0 gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30">
                              <ShieldCheck className="h-3 w-3" />
                              Доступ
                            </Badge>
                          )}
                          {status === 'pending' && (
                            <Badge variant="outline" className="shrink-0 gap-1 text-amber-600 border-amber-500/30 bg-amber-50 dark:bg-amber-950/30">
                              <Clock className="h-3 w-3" />
                              Ожидает
                            </Badge>
                          )}
                        </div>

                        {patient.phone && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                            <Phone className="h-3.5 w-3.5" />
                            {patient.phone}
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {stats && (
                            <>
                              <span>{stats.count} визит{stats.count === 1 ? '' : stats.count < 5 ? 'а' : 'ов'}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(stats.lastVisit), 'd MMM yyyy', { locale: ru })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </div>

                    {status === 'approved' && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-emerald-600">
                        <FileHeart className="h-3.5 w-3.5" />
                        <span>Медкарта доступна</span>
                      </div>
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
