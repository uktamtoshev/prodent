import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

type Tab = 'doctor_posts' | 'clinic_posts' | 'reels' | 'articles';

// Per-content-type config: which table, how to fetch the queue, and which actions apply.
// doctor_posts + articles carry is_published (publish/hide); clinic_posts + reels have no
// moderation flag, so those are reject-only (hard delete of inappropriate content).
const TABS: { key: Tab; labelKey: string; publishable: boolean }[] = [
  { key: 'doctor_posts', labelKey: 'adminModeration.tabDoctorPosts', publishable: true },
  { key: 'clinic_posts', labelKey: 'adminModeration.tabClinicPosts', publishable: false },
  { key: 'reels', labelKey: 'adminModeration.tabReels', publishable: false },
  { key: 'articles', labelKey: 'adminModeration.tabArticles', publishable: true },
];

interface ModerationItem {
  id: string;
  image: string | null;
  video?: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  isPublished: boolean | null;
}

interface DoctorPostRow { id: string; image_url: string | null; content: string | null; doctors?: { specialty?: string | null; profiles?: { full_name?: string | null } | null } | null }
interface ClinicPostRow { id: string; content: string | null; clinics?: { name?: string | null } | null }
interface ReelRow { id: string; caption: string | null; thumbnail_url: string | null; video_url: string | null }
interface ArticleRow { id: string; title: string | null; cover_url: string | null; is_published: boolean | null }

export default function Moderation() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('doctor_posts');

  const { data: items, isLoading } = useQuery({
    queryKey: ['moderation-queue', tab],
    queryFn: async () => {
      if (tab === 'doctor_posts') {
        const { data } = await supabase
          .from('doctor_posts')
          .select('id, image_url, content, doctor_id, doctors(specialty, profiles:profiles!doctors_user_id_fkey(full_name))')
          .eq('is_published', false)
          .order('created_at', { ascending: false })
          .limit(30);
        return ((data || []) as DoctorPostRow[]).map((r): ModerationItem => ({
          id: r.id,
          image: r.image_url,
          title: r.doctors?.profiles?.full_name || null,
          subtitle: r.doctors?.specialty || null,
          body: r.content,
          isPublished: false,
        }));
      }
      if (tab === 'clinic_posts') {
        const { data } = await supabase
          .from('clinic_posts')
          .select('id, content, clinic_id, created_at, clinics(name)')
          .order('created_at', { ascending: false })
          .limit(30);
        return ((data || []) as ClinicPostRow[]).map((r): ModerationItem => ({
          id: r.id,
          image: null,
          title: r.clinics?.name || null,
          subtitle: null,
          body: r.content,
          isPublished: null,
        }));
      }
      if (tab === 'reels') {
        const { data } = await supabase
          .from('reels')
          .select('id, caption, thumbnail_url, video_url, created_at')
          .order('created_at', { ascending: false })
          .limit(30);
        return ((data || []) as ReelRow[]).map((r): ModerationItem => ({
          id: r.id,
          image: r.thumbnail_url,
          video: r.video_url,
          title: r.caption || null,
          subtitle: null,
          body: null,
          isPublished: null,
        }));
      }
      // articles
      const { data } = await supabase
        .from('articles')
        .select('id, title, cover_url, is_published, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      return ((data || []) as ArticleRow[]).map((r): ModerationItem => ({
        id: r.id,
        image: r.cover_url,
        title: r.title || null,
        subtitle: null,
        body: null,
        isPublished: r.is_published,
      }));
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });

  const publishMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from(tab).update({ is_published: next }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success(t('adminModeration.approved')); },
    onError: () => toast.error(t('adminModeration.approveError')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tab).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success(t('adminModeration.rejected')); },
    onError: () => toast.error(t('adminModeration.rejectError')),
  });

  const activeTab = TABS.find((x) => x.key === tab)!;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('adminModeration.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminModeration.subtitle')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((x) => (
            <Button
              key={x.key}
              variant={tab === x.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(x.key)}
            >
              {t(x.labelKey)}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">{t('admin.loading')}</p>
        ) : !items || items.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">{t('adminModeration.empty')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-4">
                  {item.image && (
                    <img src={item.image} alt={item.title || 'Preview'} className="w-full h-48 object-cover rounded-lg" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-foreground font-medium">{item.title || t('adminModeration.noTitle')}</p>
                      {item.isPublished === false && (
                        <Badge variant="secondary">{t('adminModeration.draft')}</Badge>
                      )}
                    </div>
                    {item.subtitle && <p className="text-sm text-muted-foreground mt-1">{item.subtitle}</p>}
                    {item.body && <p className="text-sm text-muted-foreground mt-2 line-clamp-4">{item.body}</p>}
                    {item.video && (
                      <a href={item.video} target="_blank" rel="noreferrer" className="text-sm text-primary mt-2 inline-block">
                        {t('adminModeration.openVideo')}
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {activeTab.publishable && item.isPublished === false && (
                      <Button
                        onClick={() => publishMutation.mutate({ id: item.id, next: true })}
                        disabled={publishMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        {t('adminModeration.btnApprove')}
                      </Button>
                    )}
                    {activeTab.publishable && item.isPublished === true && (
                      <Button
                        onClick={() => publishMutation.mutate({ id: item.id, next: false })}
                        disabled={publishMutation.isPending}
                        variant="outline"
                        className="flex-1"
                      >
                        <EyeOff className="h-4 w-4 mr-2" />
                        {t('adminModeration.btnHide')}
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        if (window.confirm(t('adminModeration.confirmDelete'))) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      {activeTab.publishable && item.isPublished === false ? (
                        <><X className="h-4 w-4 mr-2" />{t('adminModeration.btnReject')}</>
                      ) : (
                        <><Trash2 className="h-4 w-4 mr-2" />{t('adminModeration.btnDelete')}</>
                      )}
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
