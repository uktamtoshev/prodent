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
import { SingleImageUploader } from './MediaUploader';
import { useLanguage } from '@/contexts/LanguageContext';

interface AddAwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
}

export function AddAwardDialog({
  open,
  onOpenChange,
  doctorId,
}: AddAwardDialogProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const addAward = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('doctor_awards').insert({
        doctor_id: doctorId,
        title,
        issuer: issuer || null,
        issue_date: issueDate || null,
        description: description || null,
        image_url: imageUrl || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: t('doctorAddAward.added'),
        description: t('doctorAddAward.added'),
      });
      queryClient.invalidateQueries({ queryKey: ['doctor-awards', doctorId] });
      handleClose();
    },
    onError: (error: unknown) => {
      toast({
        title: t('doctorCreatePost.error'),
        description: error instanceof Error ? error.message : t('doctorAddAward.saveError'),
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setTitle('');
    setIssuer('');
    setIssueDate('');
    setDescription('');
    setImageUrl('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('doctorAddAward.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="add-award-dialog-field-1">{t('doctorAddAward.awardName')}</Label>
            <Input id="add-award-dialog-field-1"
              placeholder={t('doctorAddAward.awardNamePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Issuer */}
          <div className="space-y-2">
            <Label htmlFor="add-award-dialog-field-2">{t('doctorAddAward.awardOrg')}</Label>
            <Input id="add-award-dialog-field-2"
              placeholder={t('doctorAddAward.awardOrgPlaceholder')}
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
            />
          </div>

          {/* Issue Date */}
          <div className="space-y-2">
            <Label htmlFor="add-award-dialog-field-3">{t('doctorAddAward.awardYear')}</Label>
            <Input id="add-award-dialog-field-3"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="add-award-dialog-field-4">{t('doctorAddAward.awardDesc')}</Label>
            <Textarea id="add-award-dialog-field-4"
              placeholder={t('doctorAddAward.awardDescPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Image */}
          <SingleImageUploader
            doctorId={doctorId}
            value={imageUrl}
            onChange={setImageUrl}
            label={t('doctorAddAward.certImage')}
            aspectRatio="aspect-video"
          />

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              {t('doctorAddAward.cancel')}
            </Button>
            <Button
              onClick={() => addAward.mutate()}
              disabled={!title.trim() || addAward.isPending}
            >
              {addAward.isPending ? t('doctorAddAward.saving') : t('doctorAddAward.add')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
