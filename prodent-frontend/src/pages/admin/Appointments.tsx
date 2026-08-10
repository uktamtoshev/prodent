import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

const LOCALE_MAP: Record<string, string> = {
  ru: 'ru-RU',
  uz: 'uz-UZ',
  uz_cyrl: 'uz-UZ',
  kz: 'kk-KZ',
  kg: 'ky-KG',
  tj: 'tg-TJ',
  en: 'en-US',
};

type AppointmentStatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

export default function Appointments() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatusFilter>('all');
  const { t, language } = useLanguage();
  const dateLocale = LOCALE_MAP[language] || 'ru-RU';

  const {
    data: appointments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-appointments', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          service,
          total_price,
          status,
          notes,
          created_at,
          patient:profiles!appointments_patient_id_fkey(full_name, phone),
          doctor:doctors!appointments_doctor_id_fkey(
            profile:profiles!doctors_user_id_fkey(full_name)
          )
        `)
        .order('appointment_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter.toUpperCase());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return 'border-[hsl(var(--success-green)/0.3)] bg-[hsl(var(--success-green)/0.1)] text-[hsl(var(--success-green))]';
      case 'completed': return 'border-primary/30 bg-primary/10 text-primary';
      case 'cancelled': return 'border-destructive/30 bg-destructive/10 text-destructive';
      default: return 'border-warning-amber/30 bg-warning-amber/10 text-warning-amber';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return t('adminAppointments.filterConfirmed');
      case 'completed': return t('adminAppointments.filterCompleted');
      case 'cancelled': return t('adminAppointments.filterCancelled');
      case 'pending': return t('adminAppointments.filterPending');
      default: return status;
    }
  };

  const term = search.trim().toLowerCase();
  const filteredAppointments = term
    ? appointments.filter((a) => {
        const haystack = [
          a.patient?.full_name,
          a.patient?.phone,
          a.doctor?.profile?.full_name,
          a.service,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      })
    : appointments;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('adminAppointments.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminAppointments.subtitle')}</p>
        </div>

        <div className="flex max-w-full flex-col gap-4 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Label htmlFor="admin-appointments-search" className="sr-only">
              {t('adminAppointments.searchPlaceholder')}
            </Label>
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-appointments-search"
              placeholder={t('adminAppointments.searchPlaceholder')}
              aria-label={t('adminAppointments.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 max-w-full border-border bg-card pl-10 text-foreground"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AppointmentStatusFilter)}>
            <Label htmlFor="admin-appointments-status" className="sr-only">
              {t('adminAppointments.colStatus')}
            </Label>
            <SelectTrigger
              id="admin-appointments-status"
              aria-label={t('adminAppointments.colStatus')}
              className="min-h-11 w-full border-border bg-card text-foreground sm:w-[200px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="min-h-11" value="all">{t('adminAppointments.filterAll')}</SelectItem>
              <SelectItem className="min-h-11" value="pending">{t('adminAppointments.filterPending')}</SelectItem>
              <SelectItem className="min-h-11" value="confirmed">{t('adminAppointments.filterConfirmed')}</SelectItem>
              <SelectItem className="min-h-11" value="completed">{t('adminAppointments.filterCompleted')}</SelectItem>
              <SelectItem className="min-h-11" value="cancelled">{t('adminAppointments.filterCancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-w-full overflow-hidden rounded-lg border border-border bg-card" data-testid="admin-appointments-table">
          <Table className="min-w-[760px]">
            <TableCaption className="sr-only">{t('adminAppointments.title')}</TableCaption>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead scope="col" className="text-muted-foreground">{t('adminAppointments.colDate')}</TableHead>
                <TableHead scope="col" className="text-muted-foreground">{t('adminAppointments.colPatient')}</TableHead>
                <TableHead scope="col" className="text-muted-foreground">{t('adminAppointments.colDoctor')}</TableHead>
                <TableHead scope="col" className="text-muted-foreground">{t('adminAppointments.colService')}</TableHead>
                <TableHead scope="col" className="text-muted-foreground">{t('adminAppointments.colPrice')}</TableHead>
                <TableHead scope="col" className="text-muted-foreground">{t('adminAppointments.colStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2" role="status">
                      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                      {t('admin.loading')}
                    </span>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center" role="alert">
                    <p className="text-destructive">{t('common.error')}</p>
                    <Button className="mt-3 min-h-11" variant="outline" onClick={() => void refetch()}>
                      {t('common.retry')}
                    </Button>
                  </TableCell>
                </TableRow>
              ) : filteredAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground" role="status">
                    {t('adminAppointments.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAppointments.map((appointment) => (
                  <TableRow key={appointment.id} className="border-border hover:bg-accent/50">
                    <TableCell className="text-muted-foreground">
                      {new Date(appointment.appointment_date).toLocaleString(dateLocale)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-foreground font-medium">{appointment.patient?.full_name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{appointment.patient?.phone || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-foreground font-medium">
                          {appointment.doctor?.profile?.full_name || 'N/A'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{appointment.service}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {appointment.total_price ? `${appointment.total_price.toLocaleString()} ${t('admin.sumCurrency')}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(appointment.status || 'pending')}>
                        {getStatusLabel(appointment.status || 'pending')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
