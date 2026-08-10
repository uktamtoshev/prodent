import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();
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
              <Badge className="bg-brand-50 text-brand-700 border-brand-700/30 hover:bg-brand-100 cursor-help gap-1">
                <Building2 className="w-3 h-3" />
                {t('crmDoctorsList.staffShort')}
                {salaryPercent && (
                  <span className="ml-1 opacity-75">({salaryPercent}%)</span>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">{t('crmDoctorsList.staffDoctor')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('crmDoctorsList.staffDescPrefix')} {salaryPercent || 30}{t('crmDoctorsList.staffDescSuffix')}
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
              <Badge className="bg-status-info/10 text-status-info border-status-info/30 hover:bg-status-info/20 cursor-help gap-1">
                <Armchair className="w-3 h-3" />
                {t('crmDoctorsList.tenantShort')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">{t('crmDoctorsList.chairTenant')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('crmDoctorsList.tenantDescription')}
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
        {t('crmDoctorsList.notSpecified')}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-surface-2 px-card-x py-card-y">
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft backdrop-blur-sm">
      <CardHeader className="border-b border-border/50 bg-surface-2 px-card-x py-card-y">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Users className="h-5 w-5" />
          {t('crmDoctorsList.clinicDoctors')}
          <Badge variant="secondary" className="ml-2 rounded-full">{doctors?.length || 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('crmDoctorsList.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 border-border bg-background pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DoctorTab)}>
          <TabsList className="grid h-auto w-full grid-cols-3 border border-border/50 bg-muted/50 p-1">
            <TabsTrigger value="all" className="gap-2 rounded-lg py-2">
              <Users className="h-4 w-4" />
              {t('crmDoctorsList.tabAll')}
              <Badge variant="secondary" className="ml-1 rounded-full">{doctors?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="staff"
              className="gap-2 rounded-lg py-2 data-[state=active]:bg-brand-50 data-[state=active]:text-brand-700"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('crmDoctorsList.tabStaff')}</span>
              <Badge className="ml-1 rounded-full bg-brand-100 text-brand-700">{staffCount}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="rental"
              className="gap-2 rounded-lg py-2 data-[state=active]:bg-status-info/10 data-[state=active]:text-status-info"
            >
              <Armchair className="h-4 w-4" />
              <span className="hidden sm:inline">{t('crmDoctorsList.tabTenants')}</span>
              <Badge className="ml-1 rounded-full bg-status-info/20 text-status-info">{rentalCount}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Tab content descriptions */}
          <div className="mt-4">
            {activeTab === 'staff' && (
              <div className="flex items-start gap-3 rounded-2xl border border-brand-700/20 bg-brand-50/50 p-4">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-700" />
                <div>
                  <p className="font-medium text-brand-700">{t('crmDoctorsList.staffDoctors')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('crmDoctorsList.staffInfoDescription')}
                  </p>
                </div>
              </div>
            )}
            {activeTab === 'rental' && (
              <div className="flex items-start gap-3 rounded-2xl border border-status-info/20 bg-status-info/5 p-4">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-info" />
                <div>
                  <p className="font-medium text-status-info">{t('crmDoctorsList.chairTenants')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('crmDoctorsList.tenantInfoDescription')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Doctors List */}
          <TabsContent value={activeTab} className="mt-4">
            {filteredDoctors?.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>{t('crmDoctorsList.noDoctorsFound')}</p>
                {activeTab === 'staff' && (
                  <p className="text-sm mt-1">{t('crmDoctorsList.noStaffDoctors')}</p>
                )}
                {activeTab === 'rental' && (
                  <p className="text-sm mt-1">{t('crmDoctorsList.noTenants')}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDoctors?.map((doctor) => (
                  <div 
                    key={doctor.id} 
                    className={`rounded-2xl border p-4 transition-colors ${
                      doctor.cooperation_type === 'staff_doctor'
                        ? 'bg-brand-50/50 border-brand-700/20 hover:bg-brand-50'
                        : doctor.cooperation_type === 'chair_rental'
                        ? 'bg-status-info/5 border-status-info/20 hover:bg-status-info/10'
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
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
                            {doctor.profile?.full_name || t('crmDoctorsList.doctor')}
                          </h4>
                          {doctor.verified && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <BadgeCheck className="w-4 h-4 text-primary" />
                                </TooltipTrigger>
                                <TooltipContent>{t('crmDoctorsList.verified')}</TooltipContent>
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
                            {t('crmDoctorsList.experience')}: {doctor.experience_years} {t('crmDoctorsList.years')}
                          </span>
                          {doctor.cooperation_type === 'staff_doctor' && doctor.salary_percent && (
                            <span className="flex items-center gap-1 text-brand-700">
                              <Percent className="w-3.5 h-3.5" />
                              {t('crmDoctorsList.rate')}: {doctor.salary_percent}%
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
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                        doctor.cooperation_type === 'staff_doctor'
                          ? 'bg-brand-100 text-brand-700'
                          : doctor.cooperation_type === 'chair_rental'
                          ? 'bg-status-info/20 text-status-info'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {getCooperationTypeIcon(doctor.cooperation_type)}
                      </div>
                    </div>

                    {/* Model explanation for rental */}
                    {doctor.cooperation_type === 'chair_rental' && (
                      <div className="mt-3 pt-3 border-t border-status-info/20">
                        <div className="flex items-center gap-2 text-xs text-status-info">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>{t('crmDoctorsList.incomeOffClinic')}</span>
                        </div>
                      </div>
                    )}

                    {/* Model explanation for staff */}
                    {doctor.cooperation_type === 'staff_doctor' && (
                      <div className="mt-3 pt-3 border-t border-brand-700/20">
                        <div className="flex items-center gap-2 text-xs text-brand-700">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>
                            {t('crmDoctorsList.clinicIncome')}: {100 - (doctor.salary_percent || 30)}% {t('crmDoctorsList.fromServices')} •
                            {t('crmDoctorsList.doctorIncome')}: {doctor.salary_percent || 30}% {t('crmDoctorsList.fromServices')}
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
        <div className="grid grid-cols-1 gap-4 border-t border-border/50 pt-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand-700/20 bg-brand-50/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                <Building2 className="h-5 w-5 text-brand-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{staffCount}</p>
                <p className="text-sm text-muted-foreground">{t('crmDoctorsList.staffDoctorsLabel')}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-status-info/20 bg-status-info/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-info/20">
                <Armchair className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{rentalCount}</p>
                <p className="text-sm text-muted-foreground">{t('crmDoctorsList.tenantsLabel')}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
