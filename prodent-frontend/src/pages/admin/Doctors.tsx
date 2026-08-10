import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/contexts/AdminContext';
import { DeleteRowButton } from '@/components/admin/DeleteRowButton';

export default function Doctors() {
  const [search, setSearch] = useState('');
  const { t } = useLanguage();
  const { isSuperAdmin } = useAdmin();

  const { data: doctors, isLoading, error } = useQuery({
    queryKey: ['admin-doctors'],
    queryFn: async () => {
      const query = supabase
        .from('doctors')
        .select(`
          id,
          specialty,
          experience_years,
          price_from,
          subscription_plan,
          verified,
          is_verified,
          created_at,
          clinic_id,
          user_id,
          profiles!doctors_user_id_fkey(full_name, avatar_url, phone),
          clinics(name, city)
        `)
        .order('created_at', { ascending: false });

      // The verification approve-flow writes `is_verified` (the real DB column),
      // so display/export must read it; keep `verified` as a legacy fallback.
      const { data, error: queryError } = await query;
      if (queryError) throw new Error(queryError.message || 'Failed to load doctors');
      return data;
    },
  });

  // Search is a client-side filter over hydrated rows (full_name + phone).
  // Filtering server-side via .ilike on the embedded profiles column is
  // silently dropped by the data-proxy shim, so it must run here.
  const term = search.trim().toLowerCase();
  const filteredDoctors = term
    ? doctors?.filter((d) => {
        const name = (d.profiles?.full_name || '').toLowerCase();
        const phone = (d.profiles?.phone || '').toLowerCase();
        return name.includes(term) || phone.includes(term);
      })
    : doctors;

  const exportToCSV = () => {
    if (!filteredDoctors) return;
    const csv = [
      t('adminDoctors.csvHeader'),
      ...filteredDoctors.map((d) =>
        [
          d.id,
          d.profiles?.full_name || '',
          d.clinics?.city || '',
          d.specialty,
          d.subscription_plan,
          (d.is_verified ?? d.verified) ? t('adminDoctors.statusActive') : t('adminDoctors.statusOnModeration'),
          new Date(d.created_at!).toLocaleDateString(),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'doctors.csv';
    a.click();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('adminDoctors.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('adminDoctors.subtitle')}</p>
          </div>
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {t('admin.exportCsv')}
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminDoctors.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border text-foreground"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminDoctors.colDoctor')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminDoctors.colSpecialty')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminDoctors.colCity')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminDoctors.colTariff')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminDoctors.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminDoctors.colExperience')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminDoctors.colRegDate')}</TableHead>
                {isSuperAdmin && (
                  <TableHead className="text-muted-foreground text-right">{t('admin.actions')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center text-muted-foreground">
                    {t('admin.loading')}
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center text-destructive">
                    {(error as Error).message || 'Ошибка загрузки данных'}
                  </TableCell>
                </TableRow>
              ) : filteredDoctors?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center text-muted-foreground">
                    {t('adminDoctors.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDoctors?.map((doctor) => (
                  <TableRow key={doctor.id} className="border-border hover:bg-accent/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={doctor.profiles?.avatar_url || ''} />
                          <AvatarFallback className="bg-[#00C6BB]/10 text-[#00C6BB]">
                            {doctor.profiles?.full_name?.[0] || 'D'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-foreground font-medium">{doctor.profiles?.full_name || t('admin.noName')}</p>
                          <p className="text-sm text-muted-foreground">{doctor.profiles?.phone || 'N/A'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{doctor.specialty}</TableCell>
                    <TableCell className="text-muted-foreground">{doctor.clinics?.city || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {doctor.subscription_plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(doctor.is_verified ?? doctor.verified) ? 'default' : 'secondary'}>
                        {(doctor.is_verified ?? doctor.verified) ? t('adminDoctors.statusActive') : t('adminDoctors.statusOnModeration')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{doctor.experience_years} {t('adminDoctors.yearsShort')}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(doctor.created_at!).toLocaleDateString()}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <DeleteRowButton table="doctors" id={doctor.id} label={doctor.profiles?.full_name || doctor.specialty} invalidateKey="admin-doctors" />
                      </TableCell>
                    )}
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
