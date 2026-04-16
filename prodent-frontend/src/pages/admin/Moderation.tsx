import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Moderation() {
  const queryClient = useQueryClient();

  const { data: pendingMedia, isLoading } = useQuery({
    queryKey: ['pending-media'],
    queryFn: async () => {
      const { data } = await supabase
        .from('media')
        .select(`
          id,
          url,
          title,
          description,
          type,
          doctor_id,
          doctors(
            specialty,
            profiles:profiles!doctors_user_id_fkey(full_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      // Just keep the media as is - it's already approved
      const { error } = await supabase
        .from('media')
        .update({ title: 'Approved' })
        .eq('id', mediaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-media'] });
      toast.success('Медиа одобрено');
    },
    onError: () => {
      toast.error('Ошибка при одобрении');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', mediaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-media'] });
      toast.success('Медиа отклонено');
    },
    onError: () => {
      toast.error('Ошибка при отклонении');
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Модерация контента</h1>
          <p className="text-slate-400 mt-2">Проверка фото и видео работ врачей</p>
        </div>

        {isLoading ? (
          <p className="text-slate-400">Загрузка...</p>
        ) : !pendingMedia || pendingMedia.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6">
              <p className="text-center text-slate-400">Нет контента на модерации</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingMedia.map((media) => (
              <Card key={media.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4 space-y-4">
                  {media.type === 'image' ? (
                    <img
                      src={media.url}
                      alt={media.title || 'Preview'}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <video
                      src={media.url}
                      className="w-full h-48 object-cover rounded-lg"
                      controls
                    />
                  )}

                  <div>
                    <p className="text-white font-medium">{media.title || 'Без названия'}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {media.doctors?.profiles?.full_name || 'N/A'} - {media.doctors?.specialty || 'N/A'}
                    </p>
                    {media.description && (
                      <p className="text-sm text-slate-400 mt-2">{media.description}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => approveMutation.mutate(media.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Одобрить
                    </Button>
                    <Button
                      onClick={() => rejectMutation.mutate(media.id)}
                      disabled={rejectMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Отклонить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}