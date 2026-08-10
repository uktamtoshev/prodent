import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Film, Plus, Trash2, Loader2, Video } from 'lucide-react';

interface ProfileReelsProps {
  ownerType: 'doctor' | 'clinic';
  ownerId: string;
  authorId?: string;
  isOwner: boolean;
}

interface Reel {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : undefined;

export function ProfileReels({
  ownerType,
  ownerId,
  authorId,
  isOwner,
}: ProfileReelsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ownerColumn = ownerType === 'doctor' ? 'doctor_id' : 'clinic_id';
  const queryKey = ['reels', ownerType, ownerId] as const;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');

  const {
    data: reels,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reels')
        .select('*')
        .eq(ownerColumn, ownerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Reel[];
    },
    enabled: !!ownerId,
  });

  const resetForm = () => {
    setVideoFile(null);
    setCaption('');
  };

  const addReel = useMutation({
    mutationFn: async () => {
      if (!videoFile) {
        throw new Error('Выберите видео');
      }

      const ext = videoFile.name.split('.').pop() || 'mp4';
      const path = `reels/${ownerId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('doctor-media')
        .upload(path, videoFile);
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('doctor-media')
        .getPublicUrl(uploadData!.path);

      const { error: insertError } = await supabase.from('reels').insert({
        [ownerColumn]: ownerId,
        author_id: authorId,
        video_url: publicUrl.publicUrl,
        caption: caption.trim() || null,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast({ title: 'Рилс добавлен' });
      queryClient.invalidateQueries({ queryKey });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Не удалось добавить рилс',
        description: errorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteReel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Рилс удалён' });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Не удалось удалить рилс',
        description: errorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Удалить этот рилс?')) {
      deleteReel.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="flex justify-end">
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Film className="w-4 h-4" />
                Добавить рилс
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый рилс</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Видео</Label>
                  <Input
                    type="file"
                    accept="video/*"
                    disabled={addReel.isPending}
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  />
                  {videoFile && (
                    <p className="text-xs text-muted-foreground">
                      {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Подпись</Label>
                  <Textarea
                    placeholder="Опишите рилс (необязательно)"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    disabled={addReel.isPending}
                    className="min-h-[72px]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    disabled={addReel.isPending}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={() => addReel.mutate()}
                    disabled={!videoFile || addReel.isPending}
                    className="gap-2"
                  >
                    {addReel.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {addReel.isPending ? 'Загрузка...' : 'Опубликовать'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Не удалось загрузить рилсы
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Повторить
          </Button>
        </div>
      ) : (reels?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Video className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Пока нет рилсов
          </h3>
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? 'Нажмите «Добавить рилс», чтобы загрузить первое видео'
              : 'Короткие видео появятся здесь'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {reels?.map((reel) => (
            <div
              key={reel.id}
              className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-muted"
            >
              <video
                src={reel.video_url}
                poster={reel.thumbnail_url || undefined}
                controls
                playsInline
                className="w-full h-full object-cover"
              />

              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleDelete(reel.id)}
                  disabled={deleteReel.isPending}
                  aria-label="Удалить рилс"
                  className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {reel.caption && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="line-clamp-2 text-xs text-white">
                    {reel.caption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
