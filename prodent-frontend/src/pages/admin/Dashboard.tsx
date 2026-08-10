import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, DollarSign, UserPlus, Building2, FileCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';

// Map the active UI language to a BCP-47 locale for date formatting.
const localeFor = (lang: string): string => {
  switch (lang) {
    case 'ru': return 'ru-RU';
    case 'uz': return 'uz-UZ';
    case 'en': return 'en-US';
    default: return 'ru-RU';
  }
};

export default function Dashboard() {
  const { t, language } = useLanguage();
  const dateLocale = localeFor(language);
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [doctors, clinics, appointments, profiles, pendingDoctorApps, pendingClinicApps] = await Promise.all([
        // Big tables: HEAD + exact count (server COUNT(*), no rows over the wire) now that the
        // proxy honours ?count=exact. Appointments especially — no more full-table download.
        supabase.from('doctors').select('id', { count: 'exact', head: true }),
        supabase.from('clinics').select('id', { count: 'exact', head: true }),
        supabase.from('appointments').select('id', { count: 'exact', head: true }),
        // These still need client-side case-insensitive filtering (role / status), so fetch rows.
        supabase.from('profiles').select('created_at, role'),
        supabase.from('doctor_applications').select('id, status'),
        supabase.from('clinic_applications').select('id, status'),
      ]);

      // Exact count from the Content-Range header; null on error so the card shows "—".
      const countHead = (res: { count: number | null; error: unknown }) =>
        res.error ? null : res.count ?? 0;

      // Pending application counts: status comparison is case-insensitive
      // (DB may store "Pending"/"PENDING") so filter client-side.
      const countPending = (res: { data: { status?: string | null }[] | null; error: unknown }) =>
        res.error
          ? null
          : res.data?.filter((r) => String(r.status ?? '').toLowerCase() === 'pending').length ?? 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Only count NEW PATIENTS today — exclude doctors/admins/etc.
      const newPatientsToday = profiles.error
        ? null
        : profiles.data?.filter(
            (p) =>
              String(p.role ?? '').toLowerCase() === 'patient' &&
              p.created_at &&
              new Date(p.created_at) >= today
          ).length ?? 0;

      return {
        totalDoctors: countHead(doctors),
        totalClinics: countHead(clinics),
        totalAppointments: countHead(appointments),
        newPatientsToday,
        pendingDoctorApplications: countPending(pendingDoctorApps),
        pendingClinicApplications: countPending(pendingClinicApps),
      };
    },
  });

  const { data: topDoctors, error: topDoctorsError, isLoading: topDoctorsLoading } = useQuery({
    queryKey: ['top-doctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          user_id,
          specialty,
          rating,
          reviews_count,
          verified
        `)
        .eq('verified', true)
        // NULLS LAST — Postgres puts NULLs first on DESC by default, which floated
        // unrated doctors (rating null) to the top of the "top-5 by rating" list.
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(5);

      // Surface the error instead of swallowing it into an empty list.
      if (error) throw error;
      if (!data) return [];

      // Get profiles for doctors
      const userIds = data.map(d => d.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      return data.map(doctor => ({
        ...doctor,
        profile: profiles?.find(p => p.id === doctor.user_id)
      }));
    },
  });

  const { data: recentAppointments, error: recentAppointmentsError, isLoading: recentAppointmentsLoading } = useQuery({
    queryKey: ['recent-appointments-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          service,
          status,
          appointment_date,
          patient_id,
          doctor_id
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      // Surface the error instead of swallowing it into an empty list.
      if (error) throw error;
      if (!data) return [];

      // Fetch patient profiles
      const patientIds = data.map(a => a.patient_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', patientIds);

      return data.map(appointment => ({
        ...appointment,
        patient: profiles?.find(p => p.id === appointment.patient_id)
      }));
    },
  });

  const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'completed': return 'text-green-400';
      case 'confirmed': return 'text-blue-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  // Format an appointment date in the active locale; render a dash when the
  // value is missing or unparseable (guards "Invalid Date").
  const formatApptDate = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(dateLocale);
  };

  const getStatusText = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'completed': return t('adminDashboard.statusCompleted');
      case 'confirmed': return t('adminDashboard.statusConfirmed');
      case 'cancelled': return t('adminDashboard.statusCancelled');
      case 'pending': return t('adminDashboard.statusPending');
      default: return status;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('adminDashboard.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminDashboard.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('adminDashboard.totalDoctors')}</CardTitle>
              <Users className="h-4 w-4 text-[#00C6BB]" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.totalDoctors ?? '—'}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('adminDashboard.totalClinics')}</CardTitle>
              <Building2 className="h-4 w-4 text-[#00C6BB]" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.totalClinics ?? '—'}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('adminDashboard.totalAppointments')}</CardTitle>
              <Calendar className="h-4 w-4 text-[#00C6BB]" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.totalAppointments ?? '—'}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('adminDashboard.newPatientsToday')}</CardTitle>
              <UserPlus className="h-4 w-4 text-[#00C6BB]" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.newPatientsToday ?? '—'}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('adminDashboard.pendingDoctorApps')}</CardTitle>
              <FileCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-yellow-500">{stats?.pendingDoctorApplications ?? '—'}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('adminDashboard.pendingClinicApps')}</CardTitle>
              <FileCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-yellow-500">{stats?.pendingClinicApplications ?? '—'}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">{t('adminDashboard.topDoctors')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topDoctors?.map((doctor, idx) => (
                  <div key={doctor.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#00C6BB]/10 flex items-center justify-center text-[#00C6BB] font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-foreground font-medium">{doctor.profile?.full_name || t('admin.noName')}</p>
                        <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-foreground font-semibold">★ {doctor.rating?.toFixed(1) || '0.0'}</span>
                      <p className="text-xs text-muted-foreground">{doctor.reviews_count || 0} {t('adminDashboard.reviews')}</p>
                    </div>
                  </div>
                ))}
                {topDoctorsError ? (
                  <p className="text-red-400 text-center py-4">{t('common.error')}</p>
                ) : topDoctorsLoading ? (
                  <p className="text-muted-foreground text-center py-4">{t('admin.loading')}</p>
                ) : (!topDoctors || topDoctors.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">{t('adminDashboard.noData')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">{t('adminDashboard.recentAppointments')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAppointments?.slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-foreground font-medium">{appointment.patient?.full_name || t('admin.noName')}</p>
                      <p className="text-sm text-muted-foreground">{appointment.service}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {formatApptDate(appointment.appointment_date)}
                      </p>
                      <p className={`text-sm ${getStatusColor(appointment.status || 'pending')}`}>
                        {getStatusText(appointment.status || 'pending')}
                      </p>
                    </div>
                  </div>
                ))}
                {recentAppointmentsError ? (
                  <p className="text-red-400 text-center py-4">{t('common.error')}</p>
                ) : recentAppointmentsLoading ? (
                  <p className="text-muted-foreground text-center py-4">{t('admin.loading')}</p>
                ) : (!recentAppointments || recentAppointments.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">{t('adminDashboard.noData')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
