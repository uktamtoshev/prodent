import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Download, ClipboardCheck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/contexts/AdminContext';
import { DeleteRowButton } from '@/components/admin/DeleteRowButton';

export default function Clinics() {
  const [search, setSearch] = useState('');
  const { t } = useLanguage();
  const { isSuperAdmin } = useAdmin();

  const { data: clinics, isLoading } = useQuery({
    queryKey: ['admin-clinics', search],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select(`
          id,
          name,
          city,
          district,
          address,
          phone,
          is_verified,
          created_at,
          doctors!doctors_clinic_id_fkey(id)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data } = await query;
      return data?.map((c) => ({
        ...c,
        doctorCount: c.doctors?.length || 0,
      }));
    },
  });

  // Export the currently-loaded clinic rows to CSV (mirrors exportToCSV in
  // admin/Doctors.tsx). Cells are quoted/escaped so commas in names/addresses
  // don't break the columns.
  const exportToCSV = () => {
    if (!clinics || clinics.length === 0) return;
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      t('adminClinics.colName'),
      t('adminClinics.colCity'),
      t('adminClinics.colAddress'),
      t('adminClinics.colPhone'),
      t('adminClinics.colDoctors'),
      t('adminClinics.colStatus'),
      t('adminClinics.colRegDate'),
    ].map(escape).join(',');

    const rows = clinics.map((c) =>
      [
        c.name,
        c.city,
        [c.district, c.address].filter(Boolean).join(', '),
        c.phone,
        c.doctorCount,
        c.is_verified ? t('adminClinics.statusActive') : t('adminClinics.statusOnModeration'),
        c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
      ].map(escape).join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clinics.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('adminClinics.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('adminClinics.subtitle')}</p>
          </div>
          <Button
            onClick={exportToCSV}
            disabled={!clinics || clinics.length === 0}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t('admin.exportCsv')}
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminClinics.searchPlaceholder')}
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
                <TableHead className="text-muted-foreground">{t('adminClinics.colName')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminClinics.colCity')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminClinics.colAddress')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminClinics.colPhone')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminClinics.colDoctors')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminClinics.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminClinics.colRegDate')}</TableHead>
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
              ) : clinics?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center text-muted-foreground">
                    {t('adminClinics.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                clinics?.map((clinic) => (
                  <TableRow key={clinic.id} className="border-border hover:bg-accent/50">
                    <TableCell className="text-foreground font-medium">{clinic.name}</TableCell>
                    <TableCell className="text-muted-foreground">{clinic.city}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {clinic.district ? `${clinic.district}, ` : ''}{clinic.address}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{clinic.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{clinic.doctorCount}</TableCell>
                    <TableCell>
                      <Badge variant={clinic.is_verified ? 'default' : 'secondary'}>
                        {clinic.is_verified ? t('adminClinics.statusActive') : t('adminClinics.statusOnModeration')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(clinic.created_at!).toLocaleDateString()}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-1" asChild>
                            <Link to="/admin/verification">
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              {t('adminSidebar.verification')}
                            </Link>
                          </Button>
                          <DeleteRowButton table="clinics" id={clinic.id} label={clinic.name} invalidateKey="admin-clinics" />
                        </div>
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
