import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useState } from 'react';
import { 
  Users, 
  Building2, 
  Armchair, 
  Stethoscope, 
  Search,
  User,
  Phone,
  Mail,
  Percent,
  Calendar,
  Briefcase,
  Info,
  BadgeCheck,
  DollarSign
} from 'lucide-react';

interface DoctorWithProfile {
  id: string;
  specialty: string;
  experience_years: number;
  cooperation_type: string | null;
  salary_percent: number | null;
  verified: boolean | null;
  created_at: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

type DoctorTab = 'all' | 'staff' | 'rental';

export function DoctorsList() {
  const { currentClinic } = useClinic();
  const [activeTab, setActiveTab] = useState<DoctorTab>('all');
  const [search, setSearch] = useState('');

  const { data: doctors, isLoading } = useQuery({
    queryKey: ['clinic-doctors-list', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          specialty,
          experience_years,
          cooperation_type,
          salary_percent,
          verified,
          created_at,
          profile:profiles!doctors_user_id_fkey(full_name, avatar_url, phone, email)
        `)
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as DoctorWithProfile[];
    },
    enabled: !!currentClinic?.id,
  });

  const filteredDoctors = doctors?.filter(doctor => {
    const matchesSearch = !search || 
      doctor.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      doctor.specialty?.toLowerCase().includes(search.toLowerCase());
    
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'staff' && doctor.cooperation_type === 'staff_doctor') ||
      (activeTab === 'rental' && doctor.cooperation_type === 'chair_rental');
    
    return matchesSearch && matchesTab;
  });

  const staffCount = doctors?.filter(d => d.cooperation_type === 'staff_doctor').length || 0;
  const rentalCount = doctors?.filter(d => d.cooperation_type === 'chair_rental').length || 0;

  const getCooperationTypeIcon = (type: string | null) => {
    if (type === 'staff_doctor') {
      return <Building2 className="w-4 h-4" />;
    }
    if (type === 'chair_rental') {
      return <Armchair className="w-4 h-4" />;
    }
    return <Briefcase className="w-4 h-4" />;
  };

  const getCooperationTypeBadge = (type: string | null, salaryPercent: number | null) => {
    if (type === 'staff_doctor') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20 cursor-help gap-1">
                <Building2 className="w-3 h-3" />
                Штатный
                {salaryPercent && (
                  <span className="ml-1 opacity-75">({salaryPercent}%)</span>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">Штатный врач</p>
                <p className="text-xs text-muted-foreground">
                  Работает на клинику. Получает {salaryPercent || 30}% от стоимости услуг. 
                  Пациенты и доходы учитываются в кассе клиники.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    if (type === 'chair_rental') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 cursor-help gap-1">
                <Armchair className="w-3 h-3" />
                Арендатор
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">Арендатор кресла</p>
                <p className="text-xs text-muted-foreground">
                  Арендует рабочее место в клинике. Платит фиксированную аренду. 
                  Ведёт своих пациентов. Доходы от услуг — вне кассы клиники.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Badge variant="outline" className="text-muted-foreground gap-1">
        <Briefcase className="w-3 h-3" />
        Не указан
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Врачи клиники
          <Badge variant="secondary" className="ml-2">{doctors?.length || 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или специализации..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DoctorTab)}>
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            <TabsTrigger value="all" className="gap-2">
              <Users className="w-4 h-4" />
              Все
              <Badge variant="secondary" className="ml-1">{doctors?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="staff" 
              className="gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Штатные</span>
              <Badge className="bg-emerald-500/20 text-emerald-500 ml-1">{staffCount}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="rental" 
              className="gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
            >
              <Armchair className="w-4 h-4" />
              <span className="hidden sm:inline">Арендаторы</span>
              <Badge className="bg-amber-500/20 text-amber-500 ml-1">{rentalCount}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Tab content descriptions */}
          <div className="mt-4">
            {activeTab === 'staff' && (
              <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <Info className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-500">Штатные врачи</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Работают на клинику и получают процент от оказанных услуг. 
                    Пациенты штатных врачей — пациенты клиники. 
                    Все доходы учитываются в кассе и аналитике.
                  </p>
                </div>
              </div>
            )}
            {activeTab === 'rental' && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500">Арендаторы кресел</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Арендуют рабочее место за фиксированную плату. 
                    Ведут своих личных пациентов. 
                    Доходы от услуг не учитываются в кассе клиники.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Doctors List */}
          <TabsContent value={activeTab} className="mt-4">
            {filteredDoctors?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Врачи не найдены</p>
                {activeTab === 'staff' && (
                  <p className="text-sm mt-1">Нет штатных врачей</p>
                )}
                {activeTab === 'rental' && (
                  <p className="text-sm mt-1">Нет арендаторов</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDoctors?.map((doctor) => (
                  <div 
                    key={doctor.id} 
                    className={`p-4 rounded-lg border transition-colors ${
                      doctor.cooperation_type === 'staff_doctor'
                        ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                        : doctor.cooperation_type === 'chair_rental'
                        ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={doctor.profile?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10">
                          <User className="h-6 w-6 text-primary" />
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-foreground">
                            {doctor.profile?.full_name || 'Врач'}
                          </h4>
                          {doctor.verified && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <BadgeCheck className="w-4 h-4 text-primary" />
                                </TooltipTrigger>
                                <TooltipContent>Верифицирован</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {getCooperationTypeBadge(doctor.cooperation_type, doctor.salary_percent)}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Stethoscope className="w-3.5 h-3.5" />
                            {doctor.specialty}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Опыт: {doctor.experience_years} лет
                          </span>
                          {doctor.cooperation_type === 'staff_doctor' && doctor.salary_percent && (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <Percent className="w-3.5 h-3.5" />
                              Ставка: {doctor.salary_percent}%
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                          {doctor.profile?.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {doctor.profile.phone}
                            </span>
                          )}
                          {doctor.profile?.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {doctor.profile.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cooperation Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        doctor.cooperation_type === 'staff_doctor'
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : doctor.cooperation_type === 'chair_rental'
                          ? 'bg-amber-500/20 text-amber-500'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {getCooperationTypeIcon(doctor.cooperation_type)}
                      </div>
                    </div>

                    {/* Model explanation for rental */}
                    {doctor.cooperation_type === 'chair_rental' && (
                      <div className="mt-3 pt-3 border-t border-amber-500/20">
                        <div className="flex items-center gap-2 text-xs text-amber-500">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Доходы от приёмов — вне кассы клиники</span>
                        </div>
                      </div>
                    )}

                    {/* Model explanation for staff */}
                    {doctor.cooperation_type === 'staff_doctor' && (
                      <div className="mt-3 pt-3 border-t border-emerald-500/20">
                        <div className="flex items-center gap-2 text-xs text-emerald-500">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>
                            Доход клиники: {100 - (doctor.salary_percent || 30)}% от услуг • 
                            Доход врача: {doctor.salary_percent || 30}% от услуг
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{staffCount}</p>
                <p className="text-sm text-muted-foreground">Штатных врачей</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Armchair className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{rentalCount}</p>
                <p className="text-sm text-muted-foreground">Арендаторов</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
