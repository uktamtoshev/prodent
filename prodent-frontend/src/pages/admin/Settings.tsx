import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Settings() {
  const { data: settings } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('*')
        .order('key');
      return data;
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
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
          <h1 className="text-3xl font-bold text-white">Настройки платформы</h1>
          <p className="text-slate-400 mt-2">Конфигурация и логи системы</p>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Глобальные настройки</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Параметр</TableHead>
                  <TableHead className="text-slate-400">Значение</TableHead>
                  <TableHead className="text-slate-400">Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings?.map((setting) => (
                  <TableRow key={setting.id} className="border-slate-800">
                    <TableCell className="text-white font-medium">{setting.key}</TableCell>
                    <TableCell className="text-slate-300 font-mono">
                      {JSON.stringify(setting.value)}
                    </TableCell>
                    <TableCell className="text-slate-400">{setting.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Логи аудита</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Дата</TableHead>
                  <TableHead className="text-slate-400">Пользователь</TableHead>
                  <TableHead className="text-slate-400">Действие</TableHead>
                  <TableHead className="text-slate-400">Тип</TableHead>
                  <TableHead className="text-slate-400">ID сущности</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs?.map((log) => (
                  <TableRow key={log.id} className="border-slate-800">
                    <TableCell className="text-slate-300">
                      {new Date(log.created_at).toLocaleString('ru-RU')}
                    </TableCell>
                    <TableCell className="text-white">{log.profile?.full_name || 'Система'}</TableCell>
                    <TableCell className="text-slate-300">{log.action}</TableCell>
                    <TableCell className="text-slate-300">{log.entity_type}</TableCell>
                    <TableCell className="text-slate-400 font-mono text-xs">{log.entity_id || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}