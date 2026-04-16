import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Paperclip, 
  X, 
  Image as ImageIcon, 
  FileText, 
  File, 
  Loader2,
  Camera,
  Folder
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MessageAttachmentProps {
  onFileSelected: (fileUrl: string, fileType: string, fileName: string) => void;
  pendingFile: { url: string; type: string; name: string } | null;
  onClearFile: () => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
];

export const MessageAttachment = ({ 
  onFileSelected, 
  pendingFile, 
  onClearFile,
  disabled 
}: MessageAttachmentProps) => {
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOpen(false);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Файл слишком большой',
        description: 'Максимальный размер файла: 30 МБ',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // For private bucket, we need signed URL
      const { data: signedUrlData } = await supabase.storage
        .from('message-attachments')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      const fileUrl = signedUrlData?.signedUrl || '';
      const fileType = file.type.startsWith('image/') ? 'image' : 'file';

      onFileSelected(fileUrl, fileType, file.name);

      toast({
        title: 'Файл загружен',
        description: file.name,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Ошибка загрузки',
        description: error.message || 'Не удалось загрузить файл',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'image')}
        accept="image/*"
        disabled={disabled || uploading}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'file')}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.stl,.txt"
        disabled={disabled || uploading}
      />

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || uploading}
            className="h-10 w-10 rounded-full hover:bg-muted"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-48 p-2" 
          side="top" 
          align="start"
          sideOffset={8}
        >
          <div className="space-y-1">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium">Фото</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Folder className="h-5 w-5 text-blue-500" />
              </div>
              <span className="font-medium">Файл</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
};

interface MessageFilePreviewProps {
  file: { url: string; type: string; name: string };
  onRemove: () => void;
}

export const MessageFilePreview = ({ file, onRemove }: MessageFilePreviewProps) => {
  return (
    <div className="mx-4 mb-2 p-3 bg-muted/50 rounded-xl border border-border/50 flex items-center gap-3">
      {file.type === 'image' ? (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          <img 
            src={file.url} 
            alt={file.name} 
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="h-6 w-6 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {file.type === 'image' ? 'Изображение' : 'Документ'}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

interface MessageFileDisplayProps {
  fileUrl: string;
  fileType: string;
  fileName?: string;
  isOwn?: boolean;
}

export const MessageFileDisplay = ({ fileUrl, fileType, fileName, isOwn }: MessageFileDisplayProps) => {
  if (fileType === 'image') {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={fileUrl}
          alt={fileName || 'Изображение'}
          className="max-w-[280px] max-h-[280px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
        isOwn 
          ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' 
          : 'bg-background/50 hover:bg-background/80'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        isOwn ? 'bg-primary-foreground/20' : 'bg-primary/10'
      }`}>
        <FileText className={`h-5 w-5 ${isOwn ? 'text-primary-foreground' : 'text-primary'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName || 'Файл'}</p>
        <p className={`text-xs ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
          Документ
        </p>
      </div>
    </a>
  );
};
