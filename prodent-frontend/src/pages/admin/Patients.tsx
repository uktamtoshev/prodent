import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Patients() {
  const [search, setSearch] = useState('');

  const { data: patients, isLoading } = useQuery({
    queryKey: ['admin-patients', search],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone,
          avatar_url,
          created_at,
          appointments(id, price)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('full_name', `%${search}%`);
      }

      const { data } = await query;
      return data?.map((p) => ({
        ...p,
        visitCount: p.appointments?.length || 0,
        totalSpent: p.appointments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0,
      }));
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Все пациенты</h1>
          <p className="text-slate-400 mt-2">Управление пациентами</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Поиск по имени пациента..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-white"
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Пациент</TableHead>
                <TableHead className="text-slate-400">Телефон</TableHead>
                <TableHead className="text-slate-400">Визитов</TableHead>
                <TableHead className="text-slate-400">Потрачено</TableHead>
                <TableHead className="text-slate-400">Дата регистрации</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : patients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400">
                    Пациенты не найдены
                  </TableCell>
                </TableRow>
              ) : (
                patients?.map((patient) => (
                  <TableRow key={patient.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={patient.avatar_url || ''} />
                          <AvatarFallback className="bg-[#00C6BB]/10 text-[#00C6BB]">
                            {patient.full_name?.[0] || 'P'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-white font-medium">{patient.full_name || 'Без имени'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{patient.phone || 'N/A'}</TableCell>
                    <TableCell className="text-slate-300">{patient.visitCount}</TableCell>
                    <TableCell className="text-slate-300">{patient.totalSpent.toLocaleString()} сум</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(patient.created_at!).toLocaleDateString()}
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