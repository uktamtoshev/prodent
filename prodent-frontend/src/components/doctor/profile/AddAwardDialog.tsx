import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
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
        title: 'Награда добавлена',
        description: 'Награда успешно добавлена в ваш профиль',
      });
      queryClient.invalidateQueries({ queryKey: ['doctor-awards', doctorId] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось добавить награду',
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
          <DialogTitle>Добавить награду</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Название награды *</Label>
            <Input
              placeholder="Например: Лучший стоматолог года"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Issuer */}
          <div className="space-y-2">
            <Label>Организация</Label>
            <Input
              placeholder="Кто выдал награду"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
            />
          </div>

          {/* Issue Date */}
          <div className="space-y-2">
            <Label>Дата получения</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              placeholder="Дополнительная информация о награде..."
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
            label="Изображение награды"
            aspectRatio="aspect-video"
          />

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Отмена
            </Button>
            <Button
              onClick={() => addAward.mutate()}
              disabled={!title.trim() || addAward.isPending}
            >
              {addAward.isPending ? 'Сохранение...' : 'Добавить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
