import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SingleImageUploader } from './MediaUploader';
import { X, Plus, ArrowLeftRight, Video, FileText, Award } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TablesInsert } from '@/integrations/supabase/types';
import { a11yLabel } from "@/lib/a11y-labels";

interface AddPortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
}

export function AddPortfolioDialog({
  open,
  onOpenChange,
  doctorId,
}: AddPortfolioDialogProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [type, setType] = useState<string>('before_after');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [beforeImage, setBeforeImage] = useState('');
  const [afterImage, setAfterImage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const addPortfolio = useMutation({
    mutationFn: async () => {
      setIsUploading(true);

      let finalMediaUrl = mediaUrl;

      // For video type, prioritize: uploaded file > YouTube URL > direct URL
      if (type === 'video') {
        if (videoFile) {
          const ext = videoFile.name.split('.').pop();
          const fileName = `${doctorId}/portfolio/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

          const { data, error } = await supabase.storage
            .from('doctor-media')
            .upload(fileName, videoFile);

          if (error) throw error;

          const { data: publicUrl } = supabase.storage
            .from('doctor-media')
            .getPublicUrl(data.path);

          finalMediaUrl = publicUrl.publicUrl;
        } else if (videoUrl.trim()) {
          finalMediaUrl = videoUrl.trim();
        }
      }

      const portfolioData: TablesInsert<'doctor_portfolio'> = {
        doctor_id: doctorId,
        type,
        title,
        description: description || null,
        tags: tags.length > 0 ? tags : null,
        is_featured: isFeatured,
      };

      if (type === 'before_after') {
        portfolioData.before_image_url = beforeImage;
        portfolioData.after_image_url = afterImage;
      } else {
        portfolioData.media_url = finalMediaUrl;
      }

      const { error } = await supabase
        .from('doctor_portfolio')
        .insert(portfolioData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: t('doctorAddPortfolio.addedToPortfolio'),
        description: t('doctorAddPortfolio.addedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['doctor-portfolio', doctorId] });
      handleClose();
    },
    onError: (error: unknown) => {
      toast({
        title: t('doctorAddPortfolio.errorTitle'),
        description: error instanceof Error ? error.message : t('doctorAddPortfolio.addItemError'),
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const handleClose = () => {
    setType('before_after');
    setTitle('');
    setDescription('');
    setBeforeImage('');
    setAfterImage('');
    setMediaUrl('');
    setVideoFile(null);
    setVideoUrl('');
    setTags([]);
    setNewTag('');
    setIsFeatured(false);
    onOpenChange(false);
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const canSubmit = () => {
    if (!title.trim()) return false;
    if (type === 'before_after') {
      return beforeImage && afterImage;
    }
    if (type === 'video') {
      return videoFile || videoUrl.trim();
    }
    return mediaUrl;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('doctorAddPortfolio.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>{t('doctorAddPortfolio.typeLabel')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before_after">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4" />
                    {t('doctorAddPortfolio.typeBeforeAfter')}
                  </div>
                </SelectItem>
                <SelectItem value="video">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    {t('doctorAddPortfolio.typeVideo')}
                  </div>
                </SelectItem>
                <SelectItem value="case">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('doctorAddPortfolio.typeCase')}
                  </div>
                </SelectItem>
                <SelectItem value="certificate">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    {t('doctorAddPortfolio.typeCertificate')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="add-portfolio-dialog-field-1">{t('doctorAddPortfolio.titleRequired')}</Label>
            <Input id="add-portfolio-dialog-field-1"
              placeholder={t('doctorAddPortfolio.titlePh')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="add-portfolio-dialog-field-2">{t('doctorAddPortfolio.descriptionLabel')}</Label>
            <Textarea id="add-portfolio-dialog-field-2"
              placeholder={t('doctorAddPortfolio.descriptionPh')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Media Upload based on type */}
          {type === 'before_after' && (
            <div className="grid grid-cols-2 gap-4">
              <SingleImageUploader
                doctorId={doctorId}
                value={beforeImage}
                onChange={setBeforeImage}
                label={t('doctorAddPortfolio.photoBefore')}
              />
              <SingleImageUploader
                doctorId={doctorId}
                value={afterImage}
                onChange={setAfterImage}
                label={t('doctorAddPortfolio.photoAfter')}
              />
            </div>
          )}

          {type === 'video' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-portfolio-dialog-field-3">{t('doctorAddPortfolio.videoLink')}</Label>
                <Input id="add-portfolio-dialog-field-3"
                  placeholder={t('doctorAddPortfolio.videoLinkPh')}
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    if (e.target.value) setVideoFile(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('doctorAddPortfolio.videoLinksHint')}
                </p>
              </div>
              <div className="text-center text-sm text-muted-foreground">{t('doctorAddPortfolio.orLabel')}</div>
              <div className="space-y-2">
                <Label>{t('doctorAddPortfolio.uploadVideo')}</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      setVideoFile(e.target.files?.[0] || null);
                      if (e.target.files?.[0]) setVideoUrl('');
                    }}
                    className="w-full"
                  />
                  {videoFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {t('doctorAddPortfolio.videoSelected')} {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {(type === 'case' || type === 'certificate') && (
            <SingleImageUploader
              doctorId={doctorId}
              value={mediaUrl}
              onChange={setMediaUrl}
              label={t('doctorAddPortfolio.imageRequired')}
              aspectRatio="aspect-video"
            />
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label>{t('doctorAddPortfolio.tags')}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('doctorAddPortfolio.addTag')}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" variant="outline" onClick={addTag} aria-label={a11yLabel("add")}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Featured */}
          <div className="flex items-center justify-between">
            <Label>{t('doctorAddPortfolio.featured')}</Label>
            <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              {t('doctorAddPortfolio.cancel')}
            </Button>
            <Button
              onClick={() => addPortfolio.mutate()}
              disabled={!canSubmit() || addPortfolio.isPending || isUploading}
            >
              {addPortfolio.isPending || isUploading ? t('doctorAddPortfolio.saving') : t('doctorAddPortfolio.add')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
