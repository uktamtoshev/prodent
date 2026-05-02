import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Building2, 
  Heart, 
  MessageCircle, 
  MoreHorizontal, 
  Image as ImageIcon, 
  Trash2,
  Video,
  Share2,
  ThumbsUp,
  Globe,
  Send
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ClinicTimelineProps {
  clinicId: string;
  clinic: any;
  isOwner: boolean;
}

const MAX_CONTENT_LENGTH = 280;

export function ClinicTimeline({ clinicId, clinic, isOwner }: ClinicTimelineProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());

  const { data: posts, isLoading } = useQuery({
    queryKey: ['clinic-posts', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_posts')
        .select(`
          *,
          media:clinic_post_media(*)
        `)
        .eq('clinic_id', clinicId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const { data: post, error: postError } = await supabase
        .from('clinic_posts')
        .insert({
          clinic_id: clinicId,
          content: newPostContent,
          post_type: selectedFiles.length > 0 ? 'media' : 'text',
        })
        .select()
        .single();

      if (postError) throw postError;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const ext = file.name.split('.').pop();
        const fileName = `clinics/${clinicId}/posts/${post.id}/${Date.now()}_${i}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('doctor-media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from('doctor-media')
          .getPublicUrl(uploadData.path);

        await supabase.from('clinic_post_media').insert({
          post_id: post.id,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          url: publicUrl.publicUrl,
          order_index: i,
        });
      }

      return post;
    },
    onSuccess: () => {
      toast({ title: 'Пост опубликован' });
      queryClient.invalidateQueries({ queryKey: ['clinic-posts'] });
      setNewPostContent('');
      setSelectedFiles([]);
      setShowCreateForm(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('clinic_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Пост удален' });
      queryClient.invalidateQueries({ queryKey: ['clinic-posts'] });
    },
  });

  const logoImage = clinic?.images?.[0];

  return (
    <div className="max-w-[680px] mx-auto space-y-4">
      {/* Create Post - Facebook style */}
      {isOwner && (
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4">
            {showCreateForm ? (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Avatar className="w-10 h-10 rounded-lg">
                    <AvatarImage src={logoImage} className="rounded-lg" />
                    <AvatarFallback className="rounded-lg">
                      <Building2 className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-[15px]">{clinic?.name}</p>
                    <p className="text-[13px] text-muted-foreground">Публичная публикация</p>
                  </div>
                </div>
                <Textarea
                  placeholder="Что нового в вашей клинике?"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={4}
                  className="text-[17px] border-0 resize-none focus-visible:ring-0 p-0"
                />
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="post-files"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground"
                      onClick={() => document.getElementById('post-files')?.click()}
                    >
                      <ImageIcon className="w-5 h-5 text-green-500" />
                      Фото
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground"
                      onClick={() => document.getElementById('post-files')?.click()}
                    >
                      <Video className="w-5 h-5 text-red-500" />
                      Видео
                    </Button>
                    {selectedFiles.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Выбрано: {selectedFiles.length}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                      Отмена
                    </Button>
                    <Button 
                      onClick={() => createPost.mutate()} 
                      disabled={!newPostContent.trim() || createPost.isPending}
                    >
                      {createPost.isPending ? 'Публикация...' : 'Опубликовать'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <Avatar className="w-10 h-10 rounded-lg">
                    <AvatarImage src={logoImage} className="rounded-lg" />
                    <AvatarFallback className="rounded-lg">
                      <Building2 className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="flex-1 text-left px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground text-[15px] transition-colors"
                  >
                    Что нового в клинике?
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowCreateForm(true)}
                    className="flex-1 gap-2 text-muted-foreground hover:bg-muted/50"
                  >
                    <Video className="w-5 h-5 text-red-500" />
                    <span className="hidden sm:inline">Видео</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowCreateForm(true)}
                    className="flex-1 gap-2 text-muted-foreground hover:bg-muted/50"
                  >
                    <ImageIcon className="w-5 h-5 text-green-500" />
                    <span className="hidden sm:inline">Фото</span>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Posts List - Facebook style */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Загрузка...</p>
        </div>
      ) : posts?.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Пока нет публикаций</h3>
            <p className="text-muted-foreground text-sm">
              {isOwner 
                ? 'Поделитесь новостями клиники с подписчиками'
                : 'Клиника ещё не опубликовала материалы'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        posts?.map((post: any) => {
          const hasMedia = post.media && post.media.length > 0;

          return (
            <Card key={post.id} className="shadow-sm border-border/50 overflow-hidden">
              {/* Post Header */}
              <div className="p-4 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10 rounded-lg">
                      <AvatarImage src={logoImage} className="rounded-lg" />
                      <AvatarFallback className="rounded-lg">
                        <Building2 className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-[15px] hover:underline cursor-pointer">
                        {clinic?.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ru })}
                        </span>
                        <span>•</span>
                        <Globe className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                  {isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => deletePost.mutate(post.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {/* Post Content - Facebook style with "See more" */}
              {post.content && (
                <div className="px-4 py-2">
                  {post.content.length > MAX_CONTENT_LENGTH && !expandedContent.has(post.id) ? (
                    <p className="text-[15px] whitespace-pre-wrap leading-relaxed">
                      {post.content.slice(0, MAX_CONTENT_LENGTH)}...
                    </p>
                  ) : (
                    <p className="text-[15px] whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  )}
                </div>
              )}

              {/* Post Media - Facebook style */}
              {hasMedia && (() => {
                const isExpanded = expandedContent.has(post.id);
                const mediaToShow = isExpanded ? post.media : post.media.slice(0, 2);
                const hiddenCount = post.media.length - 2;
                const showExpandButton = !isExpanded && (post.media.length > 2 || (post.content && post.content.length > MAX_CONTENT_LENGTH));

                return (
                  <div className="relative">
                    <div className={`${mediaToShow.length === 1 ? '' : 'grid gap-0.5'} ${mediaToShow.length === 2 ? 'grid-cols-2' : ''} ${mediaToShow.length >= 3 ? 'grid-cols-2' : ''}`}>
                      {mediaToShow.map((media: any, idx: number) => (
                        <div 
                          key={media.id} 
                          className={`relative bg-muted ${
                            mediaToShow.length === 1 ? 'aspect-[16/10]' : 
                            mediaToShow.length === 3 && idx === 0 ? 'row-span-2 aspect-square' : 
                            'aspect-square'
                          }`}
                        >
                          {media.type === 'video' ? (
                            <video src={media.url} controls className="w-full h-full object-cover" />
                          ) : (
                            <img src={media.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                    {showExpandButton && (
                      <button
                        onClick={() => setExpandedContent((prev) => new Set(prev).add(post.id))}
                        className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/80 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Ещё {hiddenCount > 0 && `+${hiddenCount} фото`}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Collapse button when expanded */}
              {expandedContent.has(post.id) && (post.media?.length > 2 || (post.content && post.content.length > MAX_CONTENT_LENGTH)) && (
                <div className="px-4 py-2">
                  <button
                    onClick={() => setExpandedContent((prev) => {
                      const next = new Set(prev);
                      next.delete(post.id);
                      return next;
                    })}
                    className="text-muted-foreground hover:underline text-sm font-medium"
                  >
                    Скрыть
                  </button>
                </div>
              )}

              {/* Reactions Summary */}
              {(post.likes_count > 0 || post.comments_count > 0) && (
                <div className="px-4 py-2 flex items-center justify-between text-[13px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {post.likes_count > 0 && (
                      <>
                        <div className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-primary">
                          <ThumbsUp className="w-3 h-3 text-white" />
                        </div>
                        <span>{post.likes_count}</span>
                      </>
                    )}
                  </div>
                  {post.comments_count > 0 && (
                    <span>{post.comments_count} комментари{post.comments_count === 1 ? 'й' : post.comments_count < 5 ? 'я' : 'ев'}</span>
                  )}
                </div>
              )}

              {/* Action Buttons - Facebook style */}
              <div className="px-4 py-1 border-t border-border">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-2 h-10 text-[15px] font-semibold text-muted-foreground hover:bg-muted/50"
                  >
                    <ThumbsUp className="w-5 h-5" />
                    Нравится
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-2 h-10 text-[15px] font-semibold text-muted-foreground hover:bg-muted/50"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Комментировать
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-2 h-10 text-[15px] font-semibold text-muted-foreground hover:bg-muted/50"
                  >
                    <Share2 className="w-5 h-5" />
                    Поделиться
                  </Button>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
