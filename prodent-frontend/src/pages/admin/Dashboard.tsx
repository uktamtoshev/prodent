import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, DollarSign, UserPlus, Building2, FileCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [doctors, clinics, appointments, profiles, pendingDoctorApps, pendingClinicApps] = await Promise.all([
        supabase.from('doctors').select('id', { count: 'exact', head: true }),
        supabase.from('clinics').select('id', { count: 'exact', head: true }),
        supabase.from('appointments').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('created_at'),
        supabase.from('doctor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('clinic_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newPatientsToday = profiles.data?.filter(
        (p) => new Date(p.created_at!) >= today
      ).length || 0;

      return {
        totalDoctors: doctors.count || 0,
        totalClinics: clinics.count || 0,
        totalAppointments: appointments.count || 0,
        newPatientsToday,
        pendingDoctorApplications: pendingDoctorApps.count || 0,
        pendingClinicApplications: pendingClinicApps.count || 0,
      };
    },
  });

  const { data: topDoctors } = useQuery({
    queryKey: ['top-doctors'],
    queryFn: async () => {
      const { data } = await supabase
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
        .order('rating', { ascending: false })
        .limit(5);

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

  const { data: recentAppointments } = useQuery({
    queryKey: ['recent-appointments-admin'],
    queryFn: async () => {
      const { data } = await supabase
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
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'confirmed': return 'text-blue-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Завершено';
      case 'confirmed': return 'Подтверждено';
      case 'cancelled': return 'Отменено';
      case 'pending': return 'Ожидает';
      default: return status;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Дашборд</h1>
          <p className="text-slate-400 mt-2">Обзор платформы DentalPro</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Врачей</CardTitle>
              <Users className="h-4 w-4 text-[#00C6BB]" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-white">{stats?.totalDoctors}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Клиник</CardTitle>
              <Building2 className="h-4 w-4 text-[#00C6BB]" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-white">{stats?.totalClinics}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Записей</CardTitle>
              <Calendar className="h-4 w-4 text-[#00C6BB]" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-white">{stats?.totalAppointments}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Новых сегодня</CardTitle>
              <UserPlus className="h-4 w-4 text-[#00C6BB]" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-white">{stats?.newPatientsToday}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Заявок врачей</CardTitle>
              <FileCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-yellow-500">{stats?.pendingDoctorApplications}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Заявок клиник</CardTitle>
              <FileCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-yellow-500">{stats?.pendingClinicApplications}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Топ-5 врачей по рейтингу</CardTitle>
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
                        <p className="text-white font-medium">{doctor.profile?.full_name || 'Без имени'}</p>
                        <p className="text-sm text-slate-400">{doctor.specialty}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-semibold">★ {doctor.rating?.toFixed(1) || '0.0'}</span>
                      <p className="text-xs text-slate-400">{doctor.reviews_count || 0} отзывов</p>
                    </div>
                  </div>
                ))}
                {(!topDoctors || topDoctors.length === 0) && (
                  <p className="text-slate-400 text-center py-4">Нет данных</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Последние записи</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAppointments?.slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{appointment.patient?.full_name || 'Без имени'}</p>
                      <p className="text-sm text-slate-400">{appointment.service}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">
                        {new Date(appointment.appointment_date).toLocaleDateString('ru-RU')}
                      </p>
                      <p className={`text-sm ${getStatusColor(appointment.status || 'pending')}`}>
                        {getStatusText(appointment.status || 'pending')}
                      </p>
                    </div>
                  </div>
                ))}
                {(!recentAppointments || recentAppointments.length === 0) && (
                  <p className="text-slate-400 text-center py-4">Нет данных</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
