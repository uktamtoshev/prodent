import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, PenLine, Trash2, FileText, ImageIcon, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ProfileArticlesProps {
  ownerType: 'doctor' | 'clinic';
  ownerId: string;
  authorId?: string;
  isOwner: boolean;
}

interface ProfileArticle {
  id: string;
  title: string;
  body: string;
  cover_url: string | null;
  created_at: string;
}

interface MutationError {
  message?: string;
}

export function ProfileArticles({ ownerType, ownerId, authorId, isOwner }: ProfileArticlesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ownerColumn = ownerType === 'doctor' ? 'doctor_id' : 'clinic_id';

  const [editorOpen, setEditorOpen] = useState(false);
  const [readerArticle, setReaderArticle] = useState<ProfileArticle | null>(null);

  // Editor form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const { data: articles, isLoading, isError, refetch } = useQuery({
    queryKey: ['articles', ownerType, ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq(ownerColumn, ownerId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProfileArticle[];
    },
    enabled: !!ownerId,
    retry: 1,
  });

  const resetForm = () => {
    setTitle('');
    setBody('');
    setCoverFile(null);
    setCoverPreview(null);
  };

  const createArticle = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim();
      const trimmedBody = body.trim();
      if (!trimmedTitle || !trimmedBody) {
        throw new Error('Заполните заголовок и текст статьи');
      }

      let coverUrl: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split('.').pop() || 'jpg';
        const path = `articles/${ownerId}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('doctor-media')
          .upload(path, coverFile);
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage
          .from('doctor-media')
          .getPublicUrl(uploadData.path);
        coverUrl = publicUrl.publicUrl;
      }

      const { error } = await supabase.from('articles').insert({
        [ownerColumn]: ownerId,
        author_id: authorId,
        title: trimmedTitle,
        cover_url: coverUrl,
        body: trimmedBody,
        is_published: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Статья опубликована' });
      queryClient.invalidateQueries({ queryKey: ['articles', ownerType, ownerId] });
      setEditorOpen(false);
      resetForm();
    },
    onError: (error: MutationError) => {
      toast({ title: 'Ошибка', description: error.message || "Unknown error", variant: 'destructive' });
    },
  });

  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('articles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Статья удалена' });
      queryClient.invalidateQueries({ queryKey: ['articles', ownerType, ownerId] });
    },
    onError: (error: MutationError) => {
      toast({ title: 'Ошибка', description: error.message || "Unknown error", variant: 'destructive' });
    },
  });

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Удалить эту статью?')) {
      deleteArticle.mutate(id);
    }
  };

  const isSaving = createArticle.isPending;

  return (
    <div className="space-y-4">
      {/* Header / create button */}
      {isOwner && (
        <div className="flex justify-end">
          <Button onClick={() => setEditorOpen(true)} className="gap-2">
            <PenLine className="w-4 h-4" />
            Написать статью
          </Button>
        </div>
      )}

      {/* List states */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Загрузка...</p>
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-muted-foreground text-sm mb-3">Не удалось загрузить статьи</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Повторить
          </button>
        </div>
      ) : (articles?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1 text-foreground">Пока нет статей</h3>
          <p className="text-muted-foreground text-sm">
            {isOwner
              ? 'Напишите первую статью, чтобы поделиться экспертизой'
              : 'Здесь пока нет опубликованных статей'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {articles?.map((a) => (
            <div
              key={a.id}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
            >
              <button
                onClick={() => setReaderArticle(a)}
                className="flex flex-1 flex-col text-left"
              >
                {a.cover_url ? (
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={a.cover_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full flex items-center justify-center bg-muted">
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="font-semibold text-foreground line-clamp-2">{a.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {a.body}
                  </p>
                  <span className="mt-auto pt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ru })}
                  </span>
                </div>
              </button>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(a.id)}
                  className="absolute right-2 top-2 h-8 w-8 rounded-full bg-card/80 text-destructive opacity-0 backdrop-blur transition-opacity hover:bg-card group-hover:opacity-100"
                  aria-label="Удалить статью"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reader dialog */}
      <Dialog open={!!readerArticle} onOpenChange={(open) => !open && setReaderArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {readerArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl leading-snug">{readerArticle.title}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(readerArticle.created_at), {
                  addSuffix: true,
                  locale: ru,
                })}
              </p>
              {readerArticle.cover_url && (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  <img
                    src={readerArticle.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                {readerArticle.body}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Editor dialog */}
      {isOwner && (
        <Dialog
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Новая статья</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="article-title">Заголовок</Label>
                <Input
                  id="article-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Заголовок статьи"
                />
              </div>

              <div className="space-y-2">
                <Label>Обложка (необязательно)</Label>
                {coverPreview ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
                    <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={clearCover}
                      className="absolute right-2 top-2 h-8 w-8 rounded-full bg-card/80 backdrop-blur hover:bg-card"
                      aria-label="Удалить обложку"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      id="article-cover"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => document.getElementById('article-cover')?.click()}
                    >
                      <ImageIcon className="w-4 h-4" />
                      Загрузить обложку
                    </Button>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-body">Текст статьи</Label>
                <Textarea
                  id="article-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Напишите текст статьи..."
                  rows={12}
                  className="resize-y"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditorOpen(false);
                  resetForm();
                }}
                disabled={isSaving}
              >
                Отмена
              </Button>
              <Button
                onClick={() => createArticle.mutate()}
                disabled={isSaving || !title.trim() || !body.trim()}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                {isSaving ? 'Публикация...' : 'Опубликовать'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
