import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Search, X, Users, Phone, Calendar } from 'lucide-react';

import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface PatientProfile {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  birth_date?: string | null;
  appointmentsCount?: number;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export default function ClinicAdminPatients() {
  const navigate = useNavigate();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const clinicId = currentClinic?.id;

  const [searchQuery, setSearchQuery] = useState('');

  const { data: patients, isLoading, error } = useQuery({
    queryKey: ['clinic-admin-patients', clinicId],
    queryFn: async () => {
      // Distinct patient_ids from appointments for this clinic
      const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('patient_id, appointment_date')
        .eq('clinic_id', clinicId);
      if (apptErr) throw new Error(apptErr.message);

      const counts = new Map<string, number>();
      (appts || []).forEach((a: any) => {
        if (a.patient_id) counts.set(a.patient_id, (counts.get(a.patient_id) || 0) + 1);
      });

      const ids = Array.from(counts.keys());
      if (ids.length === 0) return [] as PatientProfile[];

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url, created_at, birth_date')
        .in('id', ids);
      if (profErr) throw new Error(profErr.message);

      return (profiles || []).map((p: any) => ({
        ...p,
        appointmentsCount: counts.get(p.id) || 0,
      })) as PatientProfile[];
    },
    enabled: !!clinicId,
  });

  if (error) {
    toast({
      title: 'Ошибка',
      description: 'Не удалось загрузить список пациентов',
      variant: 'destructive',
    });
  }

  const filtered = useMemo(() => {
    if (!patients) return [];
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase();
    return patients.filter((p) =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(q.replace(/\s/g, '')),
    );
  }, [patients, searchQuery]);

  return (
    <ClinicAdminLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Пациенты
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentClinic ? currentClinic.name : 'Выберите клинику'} • {filtered.length} пациентов
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или телефону..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">
                {searchQuery ? 'Пациенты не найдены' : 'Нет пациентов'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery
                  ? 'Попробуйте изменить поисковый запрос.'
                  : 'Пациенты появятся здесь после первой записи к врачам клиники.'}
              </p>
              {searchQuery && (
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setSearchQuery('')}>
                  <X className="w-4 h-4" /> Очистить
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <Card
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/crm/patients/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/crm/patients/${p.id}`);
                  }
                }}
                className="border-border/50 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(p.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground truncate">
                        {p.full_name || 'Без имени'}
                      </h3>
                      {p.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="truncate">{p.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Calendar className="w-3 h-3" />
                      {p.appointmentsCount || 0} записей
                    </Badge>
                    {p.created_at && (
                      <Badge variant="outline" className="text-xs">
                        с {format(new Date(p.created_at), 'd MMM yyyy', { locale: ru })}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ClinicAdminLayout>
  );
}
