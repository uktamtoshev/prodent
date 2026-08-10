import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import type { ClinicProfileData } from './types';

interface ClinicTimelineProps {
  clinicId: string;
  clinic: ClinicProfileData;
  isOwner: boolean;
}

interface TimelineProfile { id: string; full_name: string | null; avatar_url: string | null }
interface TimelineMedia { id: string; post_id: string; media_type: string; media_url: string; sort_order?: number | null }
interface TimelineLike { post_id: string; user_id: string }
interface TimelineComment { id: string; post_id: string; user_id: string; content: string; created_at: string; user?: TimelineProfile }
interface RawTimelinePost { id: string; content: string | null; created_at: string }
interface TimelinePost extends RawTimelinePost { media: TimelineMedia[]; likes: TimelineLike[]; comments: TimelineComment[] }

const MAX_CONTENT_LENGTH = 280;

export function ClinicTimeline({ clinicId, clinic, isOwner }: ClinicTimelineProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentContent, setCommentContent] = useState<Record<string, string>>({});

  const { data: posts, isLoading, isError, refetch } = useQuery({
    queryKey: ['clinic-posts', clinicId],
    queryFn: async () => {
      // NOTE: the data-shim cannot resolve has-many embeds (media/likes/comments
      // join the wrong direction → 500), so we fetch flat and merge client-side.
      const { data: rawPosts, error } = await supabase
        .from('clinic_posts')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const typedPosts = (rawPosts || []) as RawTimelinePost[];
      const ids = typedPosts.map((post) => post.id);
      if (!ids.length) return [];

      const [{ data: media }, { data: likes }, { data: comments }] = await Promise.all([
        supabase.from('clinic_post_media').select('*').in('post_id', ids),
        supabase.from('clinic_post_likes').select('post_id, user_id').in('post_id', ids),
        supabase.from('clinic_post_comments').select('id, post_id, user_id, content, created_at').in('post_id', ids).order('created_at', { ascending: true }),
      ]);

      const commenterIds = [...new Set((comments || []).map((c) => c.user_id))];
      const { data: profs } = commenterIds.length
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', commenterIds)
        : { data: [] as TimelineProfile[] };
      const profileById = new Map(((profs || []) as TimelineProfile[]).map((profile) => [profile.id, profile]));

      const typedMedia = (media || []) as TimelineMedia[];
      const typedLikes = (likes || []) as TimelineLike[];
      const typedComments = (comments || []) as TimelineComment[];

      return typedPosts.map((post): TimelinePost => ({
        ...post,
        media: typedMedia.filter((item) => item.post_id === post.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        likes: typedLikes.filter((like) => like.post_id === post.id),
        comments: typedComments.filter((comment) => comment.post_id === post.id).map((comment) => ({ ...comment, user: profileById.get(comment.user_id) })),
      }));
    },
    enabled: !!clinicId,
    // Fail fast instead of the default 3 exponential retries, which left the
    // tab on "Загрузка..." for ~7s and then a blank area with no error shown.
    retry: 1,
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const { data: post, error: postError } = await supabase
        .from('clinic_posts')
        .insert({
          clinic_id: clinicId,
          author_id: user?.id,
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
          media_type: file.type.startsWith('video/') ? 'video' : 'image',
          media_url: publicUrl.publicUrl,
          sort_order: i,
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
    onError: (error: unknown) => {
      toast({ title: 'Ошибка', description: error instanceof Error ? error.message : 'Неизвестная ошибка', variant: 'destructive' });
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

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      const { data: existing } = await supabase
        .from('clinic_post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user?.id)
        .maybeSingle();
      if (existing) {
        await supabase.from('clinic_post_likes').delete().eq('id', existing.id);
      } else {
        await supabase.from('clinic_post_likes').insert({ post_id: postId, user_id: user?.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic-posts', clinicId] }),
  });

  const addComment = useMutation({
    mutationFn: async (postId: string) => {
      const content = commentContent[postId];
      if (!content?.trim()) return;
      const { error } = await supabase.from('clinic_post_comments').insert({
        post_id: postId,
        user_id: user?.id,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_, postId) => {
      setCommentContent((prev) => ({ ...prev, [postId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['clinic-posts', clinicId] });
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
      ) : isError ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm mb-3">Не удалось загрузить публикации</p>
            <button onClick={() => refetch()} className="text-sm font-medium text-primary hover:underline">
              Повторить
            </button>
          </CardContent>
        </Card>
      ) : (posts?.length ?? 0) === 0 ? (
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
        posts?.map((post) => {
          const hasMedia = post.media && post.media.length > 0;
          const isLiked = post.likes?.some((like) => like.user_id === user?.id);
          const likesCount = post.likes?.length || 0;
          const commentsCount = post.comments?.length || 0;

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
                      {mediaToShow.map((media, idx) => (
                        <div 
                          key={media.id} 
                          className={`relative bg-muted ${
                            mediaToShow.length === 1 ? 'aspect-[16/10]' : 
                            mediaToShow.length === 3 && idx === 0 ? 'row-span-2 aspect-square' : 
                            'aspect-square'
                          }`}
                        >
                          {media.media_type === 'video' ? (
                            <video src={media.media_url} controls className="w-full h-full object-cover" />
                          ) : (
                            <img src={media.media_url} alt="" className="w-full h-full object-cover" />
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
              {(likesCount > 0 || commentsCount > 0) && (
                <div className="px-4 py-2 flex items-center justify-between text-[13px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {likesCount > 0 && (
                      <>
                        <div className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-primary">
                          <ThumbsUp className="w-3 h-3 text-white" />
                        </div>
                        <span>{likesCount}</span>
                      </>
                    )}
                  </div>
                  {commentsCount > 0 && (
                    <button
                      onClick={() => setExpandedComments((prev) => {
                        const next = new Set(prev);
                        if (next.has(post.id)) next.delete(post.id);
                        else next.add(post.id);
                        return next;
                      })}
                      className="hover:underline"
                    >
                      {commentsCount} комментари{commentsCount === 1 ? 'й' : commentsCount < 5 ? 'я' : 'ев'}
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons - Facebook style */}
              <div className="px-4 py-1 border-t border-border">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!user}
                    onClick={() => user && toggleLike.mutate(post.id)}
                    className={`flex-1 gap-2 h-10 text-[15px] font-semibold ${isLiked ? 'text-primary' : 'text-muted-foreground'} hover:bg-muted/50`}
                  >
                    <ThumbsUp className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                    Нравится
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedComments((prev) => {
                      const next = new Set(prev);
                      if (next.has(post.id)) next.delete(post.id);
                      else next.add(post.id);
                      return next;
                    })}
                    className="flex-1 gap-2 h-10 text-[15px] font-semibold text-muted-foreground hover:bg-muted/50"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Комментировать
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-2 h-10 text-[15px] font-semibold text-muted-foreground hover:bg-muted/50"
                    onClick={async () => {
                      const url = `${window.location.origin}/clinic/${clinicId}`;
                      try {
                        if (navigator.share) {
                          await navigator.share({ url, title: clinic?.name });
                        } else {
                          await navigator.clipboard.writeText(url);
                          toast({ title: 'Ссылка скопирована' });
                        }
                      } catch {
                        /* user cancelled share — ignore */
                      }
                    }}
                  >
                    <Share2 className="w-5 h-5" />
                    Поделиться
                  </Button>
                </div>
              </div>

              {/* Comments Section */}
              {expandedComments.has(post.id) && (
                <div className="px-4 py-3 border-t border-border bg-muted/20">
                  {user && (
                    <div className="flex gap-2 mb-3">
                      <Avatar className="w-8 h-8"><AvatarFallback>U</AvatarFallback></Avatar>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Написать комментарий…"
                          value={commentContent[post.id] || ''}
                          onChange={(e) => setCommentContent((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter' && commentContent[post.id]?.trim()) addComment.mutate(post.id); }}
                          className="w-full px-3 py-2 pr-10 bg-muted rounded-full text-[15px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
                          onClick={() => {
                            if (commentContent[post.id]?.trim()) addComment.mutate(post.id);
                          }}
                          disabled={!commentContent[post.id]?.trim()}
                        >
                          <Send className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {post.comments?.map((comment) => (
                      <div key={comment.id} className="flex gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={comment.user?.avatar_url} />
                          <AvatarFallback className="text-xs">{comment.user?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="bg-muted rounded-2xl px-3 py-2">
                            <p className="text-[13px] font-semibold">{comment.user?.full_name || 'Пользователь'}</p>
                            <p className="text-[15px]">{comment.content}</p>
                          </div>
                          <div className="mt-1 ml-3 text-[12px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: false, locale: ru })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
