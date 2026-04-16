import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function Appointments() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['admin-appointments', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          service,
          price,
          status,
          notes,
          created_at,
          patient:profiles!appointments_patient_id_fkey(full_name, phone),
          doctor:doctors!appointments_doctor_id_fkey(
            specialty,
            profile:profiles!doctors_user_id_fkey(full_name)
          )
        `)
        .order('appointment_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500/10 text-green-400 border-green-400/20';
      case 'completed': return 'bg-blue-500/10 text-blue-400 border-blue-400/20';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-400/20';
      default: return 'bg-yellow-500/10 text-yellow-400 border-yellow-400/20';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Все записи</h1>
          <p className="text-slate-400 mt-2">Управление записями пациентов</p>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-800 text-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[200px] bg-slate-900 border-slate-800 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="pending">Ожидание</SelectItem>
              <SelectItem value="confirmed">Подтверждено</SelectItem>
              <SelectItem value="completed">Завершено</SelectItem>
              <SelectItem value="cancelled">Отменено</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Дата</TableHead>
                <TableHead className="text-slate-400">Пациент</TableHead>
                <TableHead className="text-slate-400">Врач</TableHead>
                <TableHead className="text-slate-400">Услуга</TableHead>
                <TableHead className="text-slate-400">Цена</TableHead>
                <TableHead className="text-slate-400">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : appointments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    Записи не найдены
                  </TableCell>
                </TableRow>
              ) : (
                appointments?.map((appointment) => (
                  <TableRow key={appointment.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-slate-300">
                      {new Date(appointment.appointment_date).toLocaleString('ru-RU')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">{appointment.patient?.full_name || 'N/A'}</p>
                        <p className="text-sm text-slate-400">{appointment.patient?.phone || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">
                          {appointment.doctor?.profile?.full_name || 'N/A'}
                        </p>
                        <p className="text-sm text-slate-400">{appointment.doctor?.specialty || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{appointment.service}</TableCell>
                    <TableCell className="text-slate-300">
                      {appointment.price ? `${appointment.price.toLocaleString()} сум` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(appointment.status || 'pending')}>
                        {appointment.status || 'pending'}
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