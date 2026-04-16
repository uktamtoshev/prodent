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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MediaUploader } from './MediaUploader';
import { Image as ImageIcon, Video, FileText, Award, Briefcase } from 'lucide-react';

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  initialType?: string;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  uploading?: boolean;
  progress?: number;
  url?: string;
  error?: string;
}

export function CreatePostDialog({
  open,
  onOpenChange,
  doctorId,
  initialType = 'post',
}: CreatePostDialogProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState(initialType);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const createPost = useMutation({
    mutationFn: async () => {
      setIsUploading(true);

      // First, upload all media files
      const uploadedMedia: { url: string; type: string }[] = [];
      
      for (const mediaFile of mediaFiles) {
        if (mediaFile.url) {
          uploadedMedia.push({ url: mediaFile.url, type: mediaFile.type });
          continue;
        }
        
        if (mediaFile.error) continue;

        const ext = mediaFile.file.name.split('.').pop();
        const fileName = `${doctorId}/posts/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

        const { data, error } = await supabase.storage
          .from('doctor-media')
          .upload(fileName, mediaFile.file);

        if (error) throw error;

        const { data: publicUrl } = supabase.storage
          .from('doctor-media')
          .getPublicUrl(data.path);

        uploadedMedia.push({
          url: publicUrl.publicUrl,
          type: mediaFile.type,
        });
      }

      // Create the post
      const { data: post, error: postError } = await supabase
        .from('doctor_posts')
        .insert({
          doctor_id: doctorId,
          content,
          post_type: postType,
        })
        .select()
        .single();

      if (postError) throw postError;

      // Add media to post
      if (uploadedMedia.length > 0) {
        const mediaInserts = uploadedMedia.map((media, index) => ({
          post_id: post.id,
          url: media.url,
          type: media.type,
          order_index: index,
        }));

        const { error: mediaError } = await supabase
          .from('doctor_post_media')
          .insert(mediaInserts);

        if (mediaError) throw mediaError;
      }

      return post;
    },
    onSuccess: () => {
      toast({
        title: 'Публикация создана',
        description: 'Ваша публикация успешно добавлена',
      });
      queryClient.invalidateQueries({ queryKey: ['doctor-posts', doctorId] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать публикацию',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const handleClose = () => {
    setContent('');
    setPostType('post');
    setMediaFiles([]);
    onOpenChange(false);
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'photo':
        return <ImageIcon className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'article':
        return <FileText className="w-4 h-4" />;
      case 'case':
        return <Briefcase className="w-4 h-4" />;
      case 'certificate':
        return <Award className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const canSubmit = content.trim() || mediaFiles.some((f) => !f.error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая публикация</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Post Type */}
          <div className="space-y-2">
            <Label>Тип публикации</Label>
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="post">Публикация</SelectItem>
                <SelectItem value="photo">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Фото
                  </div>
                </SelectItem>
                <SelectItem value="video">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Видео
                  </div>
                </SelectItem>
                <SelectItem value="article">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Статья
                  </div>
                </SelectItem>
                <SelectItem value="case">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Кейс
                  </div>
                </SelectItem>
                <SelectItem value="certificate">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Сертификат
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Текст публикации</Label>
            <Textarea
              placeholder="Напишите что-нибудь..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          {/* Media Upload */}
          <div className="space-y-2">
            <Label>Медиафайлы</Label>
            <MediaUploader
              doctorId={doctorId}
              value={mediaFiles}
              onChange={setMediaFiles}
              maxFiles={10}
              maxSizeMB={50}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Отмена
            </Button>
            <Button
              onClick={() => createPost.mutate()}
              disabled={!canSubmit || createPost.isPending || isUploading}
            >
              {createPost.isPending || isUploading ? 'Публикация...' : 'Опубликовать'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
