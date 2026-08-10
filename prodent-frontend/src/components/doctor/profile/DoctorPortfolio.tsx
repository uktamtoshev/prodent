import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Images, 
  Video, 
  FileText, 
  Award, 
  Plus,
  ArrowLeftRight,
  Play,
  Trash2,
  MoreVertical
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { AddPortfolioDialog } from './AddPortfolioDialog';
import { AddAwardDialog } from './AddAwardDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Tables } from '@/integrations/supabase/types';
import { a11yLabel } from "@/lib/a11y-labels";

interface DoctorPortfolioProps {
  doctorId: string;
  isOwner: boolean;
}

export function DoctorPortfolio({ doctorId, isOwner }: DoctorPortfolioProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<Tables<'doctor_portfolio'> | null>(null);
  const [addPortfolioOpen, setAddPortfolioOpen] = useState(false);
  const [addAwardOpen, setAddAwardOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteAwardId, setDeleteAwardId] = useState<string | null>(null);

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['doctor-portfolio', doctorId, filter],
    queryFn: async () => {
      let query = supabase
        .from('doctor_portfolio')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('type', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: awards } = useQuery({
    queryKey: ['doctor-awards', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_awards')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('issue_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deletePortfolioItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('doctor_portfolio').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t('doctorPortfolio.deleted') });
      queryClient.invalidateQueries({ queryKey: ['doctor-portfolio', doctorId] });
      setDeleteItemId(null);
    },
    onError: (error: unknown) => {
      toast({ title: t('doctorPortfolio.deleteError'), description: error instanceof Error ? error.message : t('doctorPortfolio.deleteError'), variant: 'destructive' });
    },
  });

  const deleteAward = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('doctor_awards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t('doctorPortfolio.deleted') });
      queryClient.invalidateQueries({ queryKey: ['doctor-awards', doctorId] });
      setDeleteAwardId(null);
    },
    onError: (error: unknown) => {
      toast({ title: t('doctorPortfolio.deleteError'), description: error instanceof Error ? error.message : t('doctorPortfolio.deleteError'), variant: 'destructive' });
    },
  });

  // YouTube URL helpers
  const isYouTubeUrl = (url: string) => {
    return url?.includes('youtube.com') || url?.includes('youtu.be');
  };

  const getYouTubeVideoId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getYouTubeThumbnail = (url: string) => {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
    return null;
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return null;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'before_after':
        return <ArrowLeftRight className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'case':
        return <FileText className="w-4 h-4" />;
      case 'certificate':
        return <Award className="w-4 h-4" />;
      default:
        return <Images className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      before_after: `${t('doctorPortfolio.beforePhotos')}/${t('doctorPortfolio.afterPhotos')}`,
      video: t('doctorTimeline.typeNews'),
      case: t('doctorPortfolio.workTitle'),
      certificate: t('doctorAbout.sectionCertifications'),
    };
    return labels[type] || type;
  };

  const filters = [
    { id: 'all', label: t('doctorPortfolio.filterAll'), icon: null },
    { id: 'before_after', label: t('doctorPortfolio.filterBeforeAfter'), icon: ArrowLeftRight },
    { id: 'video', label: t('doctorPortfolio.filterVideo'), icon: Video },
    { id: 'case', label: t('doctorPortfolio.filterCase'), icon: FileText },
    { id: 'certificate', label: t('doctorAbout.sectionCertifications'), icon: Award },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Tabs - Facebook Style */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              /* Форма вкладки как во всём кабинете: язычок на карточке.
                 Раньше это были круглые пилюли с двойной рамкой — они читались
                 как отдельные кнопки, а не как выбор одного среза из набора. */
              className={`cabinet-control inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                filter === f.id
                  ? 'border border-b-0 border-border bg-card font-semibold text-primary shadow-soft'
                  : 'font-medium text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.icon && <f.icon className="w-4 h-4" />}
              {f.label}
            </button>
          ))}
        </div>

        {isOwner && (
          <div className="flex gap-2">
            <Button onClick={() => setAddPortfolioOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('doctorPortfolio.addWork')}
            </Button>
            <Button variant="outline" onClick={() => setAddAwardOpen(true)} className="gap-2">
              <Award className="w-4 h-4" />
              {t('doctorAbout.add')}
            </Button>
          </div>
        )}
      </div>

      {/* Portfolio Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t('doctorPortfolio.adding')}</div>
      ) : portfolio?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('doctorPortfolio.noWorks')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {portfolio?.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden cursor-pointer group relative"
              onClick={() => setSelectedItem(item)}
            >
              <div className="aspect-square relative bg-muted">
                {item.type === 'before_after' ? (
                  <div className="w-full h-full flex">
                    <div className="w-1/2 h-full relative">
                      <img
                        src={item.before_image_url}
                        alt={t('doctorPortfolio.beforePhotos')}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 left-2 bg-background/80 px-2 py-0.5 text-xs rounded">
                        {t('doctorPortfolio.beforePhotos')}
                      </span>
                    </div>
                    <div className="w-1/2 h-full relative border-l-2 border-background">
                      <img
                        src={item.after_image_url}
                        alt={t('doctorPortfolio.afterPhotos')}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 right-2 bg-primary/80 text-primary-foreground px-2 py-0.5 text-xs rounded">
                        {t('doctorPortfolio.afterPhotos')}
                      </span>
                    </div>
                  </div>
                ) : item.type === 'video' ? (
                  <div className="w-full h-full relative">
                    <img
                      src={
                        isYouTubeUrl(item.media_url)
                          ? getYouTubeThumbnail(item.media_url) || '/placeholder.svg'
                          : item.media_url?.replace(/\.[^.]+$/, '_thumb.jpg') || '/placeholder.svg'
                      }
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-12 h-12 rounded-full bg-background/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-primary ml-1" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.media_url || '/placeholder.svg'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-white text-center p-4">
                    <p className="font-medium line-clamp-2">{item.title}</p>
                  </div>
                </div>

                {/* Type Badge */}
                <Badge
                  variant="secondary"
                  className="absolute top-2 left-2 gap-1"
                >
                  {getTypeIcon(item.type)}
                  {getTypeLabel(item.type)}
                </Badge>

                {/* Owner Actions */}
                {isOwner && (
                  <div
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8" aria-label={a11yLabel("more")}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteItemId(item.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('doctorPortfolio.removePhoto')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              
              {item.tags?.length > 0 && (
                <CardContent className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((tag: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Awards Section */}
      {(filter === 'all' || filter === 'certificate') && awards && awards.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-bold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            {t('doctorAbout.sectionCertifications')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {awards.map((award) => (
              <Card key={award.id} className="overflow-hidden group relative">
                {award.image_url && (
                  <div className="aspect-video bg-muted">
                    <img
                      src={award.image_url}
                      alt={award.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{award.title}</p>
                  {award.issuer && (
                    <p className="text-xs text-muted-foreground">{award.issuer}</p>
                  )}
                  {award.issue_date && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(award.issue_date).getFullYear()}
                    </p>
                  )}
                </CardContent>

                {/* Owner Actions */}
                {isOwner && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteAwardId(award.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedItem?.title}</DialogTitle>
          </DialogHeader>
          
          {selectedItem?.type === 'before_after' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{t('doctorPortfolio.beforePhotos')}</p>
                <img
                  src={selectedItem.before_image_url}
                  alt={t('doctorPortfolio.beforePhotos')}
                  className="w-full rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">{t('doctorPortfolio.afterPhotos')}</p>
                <img
                  src={selectedItem.after_image_url}
                  alt={t('doctorPortfolio.afterPhotos')}
                  className="w-full rounded-lg"
                />
              </div>
            </div>
          )}

          {selectedItem?.type === 'video' && selectedItem.media_url && (
            isYouTubeUrl(selectedItem.media_url) ? (
              <div className="aspect-video w-full">
                <iframe
                  src={getYouTubeEmbedUrl(selectedItem.media_url) || ''}
                  title={selectedItem.title}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <video
                src={selectedItem.media_url}
                controls
                className="w-full rounded-lg"
              />
            )
          )}

          {(selectedItem?.type === 'case' || selectedItem?.type === 'certificate') && selectedItem?.media_url && (
            <img
              src={selectedItem.media_url}
              alt={selectedItem.title}
              className="w-full rounded-lg"
            />
          )}

          {selectedItem?.description && (
            <p className="text-muted-foreground">{selectedItem.description}</p>
          )}

          {selectedItem?.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedItem.tags.map((tag: string, i: number) => (
                <Badge key={i} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Portfolio Dialog */}
      <AddPortfolioDialog
        open={addPortfolioOpen}
        onOpenChange={setAddPortfolioOpen}
        doctorId={doctorId}
      />

      {/* Add Award Dialog */}
      <AddAwardDialog
        open={addAwardOpen}
        onOpenChange={setAddAwardOpen}
        doctorId={doctorId}
      />

      {/* Delete Portfolio Item Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('doctorPortfolio.deleteWork')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('doctorPortfolio.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('doctorPortfolio.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItemId && deletePortfolioItem.mutate(deleteItemId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('doctorPortfolio.removePhoto')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Award Confirmation */}
      <AlertDialog open={!!deleteAwardId} onOpenChange={() => setDeleteAwardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('doctorPortfolio.deleteWork')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('doctorPortfolio.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('doctorPortfolio.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAwardId && deleteAward.mutate(deleteAwardId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('doctorPortfolio.removePhoto')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
