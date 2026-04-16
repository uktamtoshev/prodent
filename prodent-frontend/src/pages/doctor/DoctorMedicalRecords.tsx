import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, ShieldCheck, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function DoctorMedicalRecords() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

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

  // Получаем все записи доступа к медкартам для этого врача
  const { data: accessRecords, isLoading } = useQuery({
    queryKey: ['doctor-medical-access', doctor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_record_access')
        .select('*')
        .eq('doctor_id', doctor!.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!doctor?.id,
  });

  // Получаем профили пациентов
  const patientIds = [...new Set(accessRecords?.map(r => r.patient_id) || [])];
  const { data: patients } = useQuery({
    queryKey: ['access-patients', patientIds],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .in('id', patientIds);
      return data || [];
    },
    enabled: patientIds.length > 0,
  });

  const getPatient = (id: string) => patients?.find(p => p.id === id);
  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  // Группируем по пациенту, берём лучший статус
  const patientAccessMap = new Map<string, typeof accessRecords extends (infer T)[] | undefined ? T : never>();
  accessRecords?.forEach(record => {
    const existing = patientAccessMap.get(record.patient_id);
    if (!existing || (record.status === 'active' && existing.status !== 'active')) {
      patientAccessMap.set(record.patient_id, record);
    }
  });

  const filteredPatients = Array.from(patientAccessMap.entries()).filter(([patientId]) => {
    if (!searchQuery) return true;
    const patient = getPatient(patientId);
    const search = searchQuery.toLowerCase();
    return patient?.full_name?.toLowerCase().includes(search) || patient?.phone?.includes(search);
  });

  return (
    <DoctorLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground">Медкарты пациентов</h1>
          <p className="text-muted-foreground">Пациенты, предоставившие доступ к медкарте</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или телефону..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : filteredPatients.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-1">Нет доступных медкарт</h3>
              <p className="text-sm text-muted-foreground">
                Здесь появятся пациенты, которые предоставят вам доступ к своей медкарте
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map(([patientId, record]) => {
              const patient = getPatient(patientId);
              const isActive = record.status === 'active' && new Date(record.valid_to) > new Date();
              const isPending = record.status === 'pending';

              return (
                <Card
                  key={patientId}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/doctor/patients/${patientId}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={patient?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {getInitials(patient?.full_name || null)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{patient?.full_name || 'Пациент'}</p>
                        {patient?.phone && (
                          <p className="text-xs text-muted-foreground">{patient.phone}</p>
                        )}
                        <div className="mt-1">
                          {isActive ? (
                            <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30">
                              <ShieldCheck className="h-3 w-3" />
                              Доступ открыт
                            </Badge>
                          ) : isPending ? (
                            <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500/30 bg-amber-50 dark:bg-amber-950/30">
                              <Clock className="h-3 w-3" />
                              Ожидает
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Истёк
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
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
