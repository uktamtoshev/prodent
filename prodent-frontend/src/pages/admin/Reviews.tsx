import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Reviews() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['admin-reviews', search],
    queryFn: async () => {
      let query = supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          verified,
          created_at,
          patient:profiles!reviews_patient_id_fkey(full_name),
          doctor:doctors!reviews_doctor_id_fkey(
            specialty,
            profile:profiles!doctors_user_id_fkey(full_name)
          )
        `)
        .order('created_at', { ascending: false });

      const { data } = await query;
      return data;
    },
  });

  const toggleVerifiedMutation = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { error } = await supabase
        .from('reviews')
        .update({ verified: !verified })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Статус отзыва изменён');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Отзыв удалён');
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Отзывы и жалобы</h1>
          <p className="text-slate-400 mt-2">Модерация отзывов пациентов</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-white"
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Дата</TableHead>
                <TableHead className="text-slate-400">Пациент</TableHead>
                <TableHead className="text-slate-400">Врач</TableHead>
                <TableHead className="text-slate-400">Рейтинг</TableHead>
                <TableHead className="text-slate-400">Комментарий</TableHead>
                <TableHead className="text-slate-400">Статус</TableHead>
                <TableHead className="text-slate-400">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : reviews?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    Отзывы не найдены
                  </TableCell>
                </TableRow>
              ) : (
                reviews?.map((review) => (
                  <TableRow key={review.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-slate-300">
                      {new Date(review.created_at!).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-white">{review.patient?.full_name || 'N/A'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-white">{review.doctor?.profile?.full_name || 'N/A'}</p>
                        <p className="text-sm text-slate-400">{review.doctor?.specialty || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-white">{review.rating}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300 max-w-xs truncate">
                      {review.comment || 'Без комментария'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={review.verified ? 'default' : 'secondary'}>
                        {review.verified ? 'Опубликован' : 'Скрыт'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toggleVerifiedMutation.mutate({
                              id: review.id,
                              verified: review.verified || false,
                            })
                          }
                        >
                          {review.verified ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => deleteMutation.mutate(review.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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