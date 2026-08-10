import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Settings() {
  const { t } = useLanguage();
  // NOTE (pilot): platform_settings is NOT writable through the generic /data
  // proxy (no dedicated AdminController mutation yet), so this card stays
  // read-only and is clearly labelled "только просмотр". Editing global params
  // is done directly in the DB until a save endpoint exists.
  const { data: settings, isError: settingsError } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('key');
      if (error) throw error;
      return data;
    },
  });

  const { data: auditLogs, isError: auditError } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!data) return [];

      const userIds = data.map(l => l.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      return data.map(log => ({
        ...log,
        profile: profiles?.find(p => p.id === log.user_id)
      }));
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('adminSettings.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminSettings.subtitle')}</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-foreground">{t('adminSettings.globalSettings')}</CardTitle>
              <Badge variant="outline" className="gap-1.5 text-muted-foreground shrink-0">
                <Eye className="h-3.5 w-3.5" />
                Только просмотр
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">{t('adminSettings.colParam')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('adminSettings.colValue')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('adminSettings.colDescription')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settingsError ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Не удалось загрузить настройки
                    </TableCell>
                  </TableRow>
                ) : settings?.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Настройки не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  settings?.map((setting) => (
                    <TableRow key={setting.id} className="border-border">
                      <TableCell className="text-foreground font-medium">{setting.key}</TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {JSON.stringify(setting.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{setting.description}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">{t('adminSettings.auditLogs')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">{t('adminSettings.colDate')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('adminSettings.colUser')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('adminSettings.colAction')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('adminSettings.colType')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('adminSettings.colEntityId')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditError ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Не удалось загрузить журнал
                    </TableCell>
                  </TableRow>
                ) : auditLogs?.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Записей нет
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs?.map((log) => (
                    <TableRow key={log.id} className="border-border">
                      <TableCell className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-foreground">{log.profile?.full_name || t('adminSettings.systemUser')}</TableCell>
                      <TableCell className="text-muted-foreground">{log.action}</TableCell>
                      <TableCell className="text-muted-foreground">{log.entity_type}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{log.entity_id || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
