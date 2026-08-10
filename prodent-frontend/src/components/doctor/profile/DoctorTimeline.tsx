import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  Image as ImageIcon,
  Video,
  FileText,
  Award,
  Send,
  Trash2,
  Briefcase,
  Globe,
  ThumbsUp
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreatePostDialog } from './CreatePostDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { a11yLabel } from "@/lib/a11y-labels";

interface DoctorTimelineProps {
  doctorId: string;
  isOwner: boolean;
}

const MAX_CONTENT_LENGTH = 280;

type DoctorPostRow = {
  id: string;
  doctor_id?: string | null;
  user_id?: string | null;
  content?: string | null;
  post_type?: string | null;
  created_at?: string | null;
  is_published?: boolean | null;
};

type DoctorPostMediaRow = {
  id: string;
  post_id: string;
  media_url?: string | null;
  media_type?: string | null;
  order_index?: number | null;
};

type DoctorPostLikeRow = {
  post_id: string;
  user_id: string;
};

type CommentProfile = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

type DoctorPostCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content?: string | null;
  created_at?: string | null;
};

type DoctorPostComment = DoctorPostCommentRow & {
  user?: CommentProfile;
};

type DoctorPost = DoctorPostRow & {
  media: DoctorPostMediaRow[];
  likes: DoctorPostLikeRow[];
  comments: DoctorPostComment[];
};

type MutationError = { message?: string } | Error | unknown;

export function DoctorTimeline({ doctorId, isOwner }: DoctorTimelineProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentContent, setCommentContent] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [initialPostType, setInitialPostType] = useState('post');
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['doctor-posts', doctorId],
    queryFn: async () => {
      // The data-shim cannot resolve has-many / nested embeds (it joins the wrong
      // direction → 500), so fetch flat and merge client-side.
      const { data: rawPosts, error } = await supabase
        .from('doctor_posts')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (rawPosts || []).map((p) => p.id);
      if (!ids.length) return [];

      const [{ data: media }, { data: likes }, { data: comments }] = await Promise.all([
        supabase.from('doctor_post_media').select('*').in('post_id', ids),
        supabase.from('doctor_post_likes').select('post_id, user_id').in('post_id', ids),
        supabase.from('doctor_post_comments').select('id, post_id, user_id, content, created_at').in('post_id', ids).order('created_at', { ascending: true }),
      ]);

      const commenterIds = [...new Set((comments || []).map((c) => c.user_id))];
      const { data: profs } = commenterIds.length
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', commenterIds)
        : { data: [] as CommentProfile[] };
      const profById = Object.fromEntries(
        ((profs || []) as CommentProfile[]).map((p) => [p.id, p])
      );

      return ((rawPosts || []) as DoctorPostRow[]).map((p): DoctorPost => ({
        ...p,
        media: ((media || []) as DoctorPostMediaRow[])
          .filter((m) => m.post_id === p.id)
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
        likes: ((likes || []) as DoctorPostLikeRow[]).filter((l) => l.post_id === p.id),
        comments: ((comments || []) as DoctorPostCommentRow[])
          .filter((c) => c.post_id === p.id)
          .map((c) => ({ ...c, user: profById[c.user_id] })),
      }));
    },
  });

  const { data: doctorProfile } = useQuery({
    queryKey: ['doctor-profile-for-posts', doctorId],
    queryFn: async () => {
      const { data } = await supabase
        .from('doctors')
        .select('profile:profiles!doctors_user_id_fkey(full_name, avatar_url)')
        .eq('id', doctorId)
        .maybeSingle();
      return data;
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      const { data: existing } = await supabase
        .from('doctor_post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('doctor_post_likes').delete().eq('id', existing.id);
      } else {
        await supabase.from('doctor_post_likes').insert({
          post_id: postId,
          user_id: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-posts', doctorId] });
    },
  });

  const addComment = useMutation({
    mutationFn: async (postId: string) => {
      const content = commentContent[postId];
      if (!content?.trim()) return;

      const { error } = await supabase.from('doctor_post_comments').insert({
        post_id: postId,
        user_id: user?.id,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_, postId) => {
      setCommentContent((prev) => ({ ...prev, [postId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['doctor-posts', doctorId] });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      await supabase.from('doctor_post_media').delete().eq('post_id', postId);
      await supabase.from('doctor_post_likes').delete().eq('post_id', postId);
      await supabase.from('doctor_post_comments').delete().eq('post_id', postId);
      const { error } = await supabase.from('doctor_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t('doctorTimeline.deleted') });
      queryClient.invalidateQueries({ queryKey: ['doctor-posts', doctorId] });
      setDeletePostId(null);
    },
    onError: (error: MutationError) => {
      toast({ title: t('doctorTimeline.deleteError'), description: error.message, variant: 'destructive' });
    },
  });

  const getPostTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      post: t('doctorTimeline.published'),
      photo: t('doctorTimeline.uploadMedia'),
      video: t('doctorTimeline.uploadMedia'),
      article: t('doctorTimeline.published'),
      case: t('doctorTimeline.published'),
      certificate: t('doctorTimeline.published'),
    };
    return labels[type] || t('doctorTimeline.published');
  };

  const openCreatePost = (type: string = 'post') => {
    setInitialPostType(type);
    setCreatePostOpen(true);
  };

  return (
    <div className="max-w-[680px] mx-auto space-y-4">
      {/* Create Post Card - Facebook style */}
      {isOwner && (
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-card-x">
            <div className="flex gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={doctorProfile?.profile?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground">D</AvatarFallback>
              </Avatar>
              <button
                onClick={() => openCreatePost('post')}
                className="flex-1 text-left px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground text-base transition-colors"
              >
                {t('doctorTimeline.postContentPlaceholder')}
              </button>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => openCreatePost('video')}
                className="flex-1 gap-2 text-muted-foreground hover:bg-muted/50"
              >
                <Video className="w-5 h-5 text-status-danger" />
                <span className="hidden sm:inline">{t('doctorTimeline.typeNews')}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => openCreatePost('photo')}
                className="flex-1 gap-2 text-muted-foreground hover:bg-muted/50"
              >
                <ImageIcon className="w-5 h-5 text-status-success" />
                <span className="hidden sm:inline">{t('doctorPortfolio.beforePhotos')}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => openCreatePost('case')}
                className="flex-1 gap-2 text-muted-foreground hover:bg-muted/50"
              >
                <Briefcase className="w-5 h-5 text-status-info" />
                <span className="hidden sm:inline">{t('doctorPortfolio.workTitle')}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => openCreatePost('certificate')}
                className="flex-1 gap-2 text-muted-foreground hover:bg-muted/50"
              >
                <Award className="w-5 h-5 text-status-warning" />
                <span className="hidden sm:inline">{t('doctorAbout.sectionCertifications')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">{t('doctorTimeline.loading')}</p>
        </div>
      ) : posts?.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold mb-1">{t('doctorTimeline.noPosts')}</h3>
            <p className="text-muted-foreground text-sm">
              {isOwner
                ? t('doctorTimeline.postContentPlaceholder')
                : t('doctorTimeline.noPosts')
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts?.map((post) => {
            const isLiked = post.likes?.some((l) => l.user_id === user?.id);
            const likesCount = post.likes?.length || 0;
            const commentsCount = post.comments?.length || 0;
            const hasMedia = post.media && post.media.length > 0;

            return (
              <Card key={post.id} className="shadow-sm border-border/50 overflow-hidden">
                {/* Post Header */}
                <div className="p-4 pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={doctorProfile?.profile?.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground">D</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-base text-foreground hover:underline cursor-pointer">
                            {doctorProfile?.profile?.full_name}
                          </span>
                          <span className="text-muted-foreground text-base">
                            {getPostTypeLabel(post.post_type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ru })}
                          </span>
                          <span>•</span>
                          <Globe className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" aria-label={a11yLabel("more")}>
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Share2 className="w-4 h-4 mr-2" />
                          {t('doctorProfileHeader.shareProfile')}
                        </DropdownMenuItem>
                        {isOwner && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeletePostId(post.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('doctorTimeline.removeMedia')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Post Content - Facebook style with "See more" */}
                {post.content && (
                  <div className="px-4 py-2">
                    {post.content.length > MAX_CONTENT_LENGTH && !expandedContent.has(post.id) ? (
                      <p className="text-base whitespace-pre-wrap leading-relaxed">
                        {post.content.slice(0, MAX_CONTENT_LENGTH)}...
                      </p>
                    ) : (
                      <p className="text-base whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>
                    )}
                  </div>
                )}

                {/* Post Media - Facebook style grid */}
                {hasMedia && (() => {
                  const isExpanded = expandedContent.has(post.id);
                  const mediaToShow = isExpanded ? post.media : post.media.slice(0, 2);
                  const hiddenCount = post.media.length - 2;
                  const showExpandButton = !isExpanded && (post.media.length > 2 || (post.content && post.content.length > MAX_CONTENT_LENGTH));

                  return (
                    <div className="relative">
                      <div className={`${mediaToShow.length === 1 ? '' : 'grid gap-0.5'} ${mediaToShow.length === 2 ? 'grid-cols-2' : ''} ${mediaToShow.length >= 3 ? 'grid-cols-2' : ''}`}>
                        {mediaToShow.map((m: DoctorPostMediaRow, idx: number) => (
                          <div 
                            key={m.id} 
                            className={`relative bg-muted ${
                              mediaToShow.length === 1 ? 'aspect-[16/10]' : 
                              mediaToShow.length === 3 && idx === 0 ? 'row-span-2 aspect-square' : 
                              'aspect-square'
                            }`}
                          >
                            {m.type === 'image' ? (
                              <img
                                src={m.url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={m.url}
                                controls
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      {showExpandButton && (
                        <button
                          onClick={() => setExpandedContent((prev) => new Set(prev).add(post.id))}
                          className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/80 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {t('doctorTimeline.loadMore')} {hiddenCount > 0 && `+${hiddenCount}`}
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
                      {t('doctorTimeline.removeMedia')}
                    </button>
                  </div>
                )}

                {/* Reactions Summary */}
                {(likesCount > 0 || commentsCount > 0) && (
                  <div className="px-4 py-2 flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      {likesCount > 0 && (
                        <>
                          <div className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-primary">
                            <ThumbsUp className="w-3 h-3 text-primary-foreground" />
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
                        {commentsCount} {t('doctorTimeline.comments')}
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
                      onClick={() => user && toggleLike.mutate(post.id)}
                      className={`flex-1 gap-2 h-10 text-base font-semibold ${isLiked ? 'text-primary' : 'text-muted-foreground'} hover:bg-muted/50`}
                    >
                      <ThumbsUp className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                      {t('doctorTimeline.likes')}
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
                      className="flex-1 gap-2 h-10 text-base font-semibold text-muted-foreground hover:bg-muted/50"
                    >
                      <MessageCircle className="w-5 h-5" />
                      {t('doctorTimeline.addComment')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-2 h-10 text-base font-semibold text-muted-foreground hover:bg-muted/50"
                    >
                      <Share2 className="w-5 h-5" />
                      {t('doctorProfileHeader.shareProfile')}
                    </Button>
                  </div>
                </div>

                {/* Comments Section */}
                {expandedComments.has(post.id) && (
                  <div className="px-4 py-3 border-t border-border bg-muted/20">
                    {/* Comment Input */}
                    {user && (
                      <div className="flex gap-2 mb-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder={t('doctorTimeline.commentPlaceholder')}
                            value={commentContent[post.id] || ''}
                            onChange={(e) => setCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && commentContent[post.id]?.trim()) {
                                addComment.mutate(post.id);
                              }
                            }}
                            className="w-full px-3 py-2 pr-10 bg-muted rounded-full text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
                            onClick={() => commentContent[post.id]?.trim() && addComment.mutate(post.id)}
                            disabled={!commentContent[post.id]?.trim()}
                          >
                            <Send className="w-4 h-4 text-primary" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Comments List */}
                    <div className="space-y-2">
                      {post.comments?.map((comment: DoctorPostComment) => (
                        <div key={comment.id} className="flex gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={comment.user?.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {comment.user?.full_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="bg-muted rounded-2xl px-3 py-2">
                              <p className="text-sm font-semibold">
                                {comment.user?.full_name || t('doctorTimeline.authorFallback')}
                              </p>
                              <p className="text-base">{comment.content}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-3 text-xs text-muted-foreground">
                              <button className="font-semibold hover:underline">{t('doctorTimeline.likes')}</button>
                              <button className="font-semibold hover:underline">{t('doctorTimeline.sendComment')}</button>
                              <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: false, locale: ru })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <CreatePostDialog
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        doctorId={doctorId}
        initialType={initialPostType}
      />

      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('doctorTimeline.deletePost')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('doctorTimeline.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('doctorTimeline.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePostId && deletePost.mutate(deletePostId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('doctorTimeline.removeMedia')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
