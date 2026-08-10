import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Phone, Mail, CalendarClock, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';
import { formatAccountId } from '@/lib/accountId';

interface UserLite {
  id: string;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  /** Eight-digit id from `profiles.account_number` (V131); uuid is the fallback. */
  account_number?: string | null;
  created_at: string | null;
  roles: { id: string; role: string }[];
}

interface Props {
  user: UserLite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AppointmentRow {
  id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  appointment_date: string | null;
  start_time: string | null;
  status: string | null;
  total_price: number | string | null;
  service: string | null;
}

interface AppointmentVisit extends AppointmentRow {
  doctorName: string | null;
  clinicName: string | null;
}

interface DoctorRow { id: string; user_id: string | null }
interface ProfileRow { id: string; full_name: string | null }
interface ClinicRow { id: string; name: string | null }
const SUPPORT_VISITS_LIMIT = 100;

// Support card: a read-only 360° view of one user for the admin help desk — profile,
// roles, and their appointment history (as a patient). ADMIN reads appointments via the
// proxy after the Tier A owner-scope bypass, so no dedicated endpoint is needed.
export function UserDetailDialog({ user, open, onOpenChange }: Props) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';

  const { data: visits, isLoading, isError } = useQuery({
    queryKey: ['admin-user-visits', user?.id],
    enabled: open && !!user?.id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('appointments')
        .select('id, doctor_id, clinic_id, appointment_date, start_time, status, total_price, service')
        .eq('patient_id', user!.id)
        .limit(SUPPORT_VISITS_LIMIT)
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      const appointments = (rows ?? []) as AppointmentRow[];
      if (appointments.length === 0) return [] as AppointmentVisit[];

      const doctorIds = [...new Set(appointments.map((row) => row.doctor_id).filter((id): id is string => Boolean(id)))];
      const clinicIds = [...new Set(appointments.map((row) => row.clinic_id).filter((id): id is string => Boolean(id)))];
      const { data: doctorRows } = doctorIds.length
        ? await supabase.from('doctors').select('id, user_id').in('id', doctorIds)
        : { data: [] as DoctorRow[] };
      const doctors = (doctorRows ?? []) as DoctorRow[];
      const docUserIds = [...new Set(doctors.map((doctor) => doctor.user_id).filter((id): id is string => Boolean(id)))];
      const { data: docProfiles } = docUserIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', docUserIds)
        : { data: [] as ProfileRow[] };
      const { data: clinicRows } = clinicIds.length
        ? await supabase.from('clinics').select('id, name').in('id', clinicIds)
        : { data: [] as ClinicRow[] };

      const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
      const doctorNameByUserId = new Map(((docProfiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.full_name]));
      const clinicNameById = new Map(((clinicRows ?? []) as ClinicRow[]).map((clinic) => [clinic.id, clinic.name]));

      return appointments.map((appointment): AppointmentVisit => {
        const doctor = appointment.doctor_id ? doctorById.get(appointment.doctor_id) : undefined;
        return {
          ...appointment,
          doctorName: doctor?.user_id ? doctorNameByUserId.get(doctor.user_id) || null : null,
          clinicName: appointment.clinic_id ? clinicNameById.get(appointment.clinic_id) || null : null,
        };
      });
    },
  });

  const completed = (visits || []).filter((visit) => String(visit.status).toUpperCase() === 'COMPLETED');
  const spent = completed.reduce((sum, visit) => sum + (Number(visit.total_price) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user?.full_name || t('admin.noName')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('adminUserCard.history')}
          </DialogDescription>
        </DialogHeader>

        {user && (
          <div className="space-y-6">
            {/* Profile summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {user.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {user.phone}
                </div>
              )}
              {user.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> {user.email}
                </div>
              )}
              {/* Number first — it is what the caller on the phone reads out.
                  The uuid stays in the tooltip for exact lookups. */}
              <div className="text-muted-foreground col-span-2 font-mono text-xs" title={user.id}>
                ID: {user.account_number || formatAccountId(user.id)}
              </div>
              <div className="col-span-2 flex flex-wrap gap-2">
                {user.roles.length === 0 ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {t('adminUsers.noRoles')}
                  </Badge>
                ) : (
                  user.roles.map((r) => (
                    <Badge key={r.id} variant="outline">
                      {r.role}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" /> {t('adminUserCard.visits')}
                </p>
                <p className="text-xl font-bold text-foreground">{completed.length}</p>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5" /> {t('adminUserCard.spent')}
                </p>
                <p className="text-xl font-bold text-foreground">{formatPrice(spent)}</p>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t('adminUserCard.totalAppointments')}</p>
                <p className="text-xl font-bold text-foreground">{visits?.length ?? 0}</p>
              </div>
            </div>

            {/* Appointment history */}
            <div>
              <h3 className="font-medium mb-2">{t('adminUserCard.history')}</h3>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isError ? (
                <p className="text-sm text-destructive py-4">Не удалось загрузить историю</p>
              ) : (visits?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t('adminUserCard.noHistory')}</p>
              ) : (
                <div className="space-y-2">
                  {visits!.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between border border-border rounded-lg p-3 text-sm"
                    >
                      <div>
                        <p className="text-foreground">{v.service || v.doctorName || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.doctorName ? `${v.doctorName} · ` : ''}{v.clinicName || ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="mb-1">{v.status}</Badge>
                        <p className="text-xs text-muted-foreground">
                          {v.appointment_date ? new Date(v.appointment_date).toLocaleDateString(dateLocale) : ''}
                          {v.total_price != null ? ` · ${formatPrice(Number(v.total_price))}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
