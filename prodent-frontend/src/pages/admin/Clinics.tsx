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
import { Badge } from '@/components/ui/badge';

export default function Clinics() {
  const [search, setSearch] = useState('');

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
          verified,
          created_at,
          doctors(id)
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Все клиники</h1>
            <p className="text-slate-400 mt-2">Управление клиниками</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Экспорт CSV
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск по названию клиники..."
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
                <TableHead className="text-slate-400">Название</TableHead>
                <TableHead className="text-slate-400">Город</TableHead>
                <TableHead className="text-slate-400">Адрес</TableHead>
                <TableHead className="text-slate-400">Телефон</TableHead>
                <TableHead className="text-slate-400">Врачей</TableHead>
                <TableHead className="text-slate-400">Статус</TableHead>
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
              ) : clinics?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    Клиники не найдены
                  </TableCell>
                </TableRow>
              ) : (
                clinics?.map((clinic) => (
                  <TableRow key={clinic.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-white font-medium">{clinic.name}</TableCell>
                    <TableCell className="text-slate-300">{clinic.city}</TableCell>
                    <TableCell className="text-slate-300 max-w-xs truncate">
                      {clinic.district ? `${clinic.district}, ` : ''}{clinic.address}
                    </TableCell>
                    <TableCell className="text-slate-300">{clinic.phone}</TableCell>
                    <TableCell className="text-slate-300">{clinic.doctorCount}</TableCell>
                    <TableCell>
                      <Badge variant={clinic.verified ? 'default' : 'secondary'}>
                        {clinic.verified ? 'Активна' : 'На модерации'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(clinic.created_at!).toLocaleDateString()}
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