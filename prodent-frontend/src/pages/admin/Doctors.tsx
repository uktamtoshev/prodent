import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
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

export default function Doctors() {
  const [search, setSearch] = useState('');

  const { data: doctors, isLoading } = useQuery({
    queryKey: ['admin-doctors', search],
    queryFn: async () => {
      let query = supabase
        .from('doctors')
        .select(`
          id,
          specialty,
          experience_years,
          price_from,
          subscription_plan,
          verified,
          created_at,
          clinic_id,
          user_id,
          profiles!doctors_user_id_fkey(full_name, avatar_url, phone),
          clinics(name, city)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('profiles.full_name', `%${search}%`);
      }

      const { data } = await query;
      return data;
    },
  });

  const exportToCSV = () => {
    if (!doctors) return;
    const csv = [
      ['ID', 'ФИО', 'Город', 'Специальность', 'Тариф', 'Статус', 'Дата регистрации'].join(','),
      ...doctors.map((d) =>
        [
          d.id,
          d.profiles?.full_name || '',
          d.clinics?.city || '',
          d.specialty,
          d.subscription_plan,
          d.verified ? 'Активен' : 'На модерации',
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
            <h1 className="text-3xl font-bold text-white">Все врачи</h1>
            <p className="text-slate-400 mt-2">Управление профилями врачей</p>
          </div>
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Экспорт CSV
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск по имени врача..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-800 text-white"
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Врач</TableHead>
                <TableHead className="text-slate-400">Специальность</TableHead>
                <TableHead className="text-slate-400">Город</TableHead>
                <TableHead className="text-slate-400">Тариф</TableHead>
                <TableHead className="text-slate-400">Статус</TableHead>
                <TableHead className="text-slate-400">Опыт</TableHead>
                <TableHead className="text-slate-400">Дата регистрации</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : doctors?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    Врачи не найдены
                  </TableCell>
                </TableRow>
              ) : (
                doctors?.map((doctor) => (
                  <TableRow key={doctor.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={doctor.profiles?.avatar_url || ''} />
                          <AvatarFallback className="bg-[#00C6BB]/10 text-[#00C6BB]">
                            {doctor.profiles?.full_name?.[0] || 'D'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white font-medium">{doctor.profiles?.full_name || 'Без имени'}</p>
                          <p className="text-sm text-slate-400">{doctor.profiles?.phone || 'N/A'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{doctor.specialty}</TableCell>
                    <TableCell className="text-slate-300">{doctor.clinics?.city || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {doctor.subscription_plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={doctor.verified ? 'default' : 'secondary'}>
                        {doctor.verified ? 'Активен' : 'На модерации'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">{doctor.experience_years} лет</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(doctor.created_at!).toLocaleDateString()}
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