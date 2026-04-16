import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Upload, Image as ImageIcon, Video, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  uploading?: boolean;
  progress?: number;
  url?: string;
  error?: string;
}

interface MediaUploaderProps {
  doctorId: string;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  multiple?: boolean;
  value?: MediaFile[];
  onChange: (files: MediaFile[]) => void;
  onUploadComplete?: (urls: { url: string; type: string }[]) => void;
}

export function MediaUploader({
  doctorId,
  accept = 'image/*,video/*',
  maxFiles = 10,
  maxSizeMB = 50,
  multiple = true,
  value = [],
  onChange,
  onUploadComplete,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const newFiles: MediaFile[] = [];
    const maxSize = maxSizeMB * 1024 * 1024;

    Array.from(files).forEach((file) => {
      if (value.length + newFiles.length >= maxFiles) return;
      
      if (file.size > maxSize) {
        newFiles.push({
          file,
          preview: '',
          type: file.type.startsWith('video') ? 'video' : 'image',
          error: `Файл слишком большой (макс ${maxSizeMB}MB)`,
        });
        return;
      }

      const isVideo = file.type.startsWith('video');
      const preview = URL.createObjectURL(file);

      newFiles.push({
        file,
        preview,
        type: isVideo ? 'video' : 'image',
      });
    });

    onChange([...value, ...newFiles]);
  }, [value, maxFiles, maxSizeMB, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (index: number) => {
    const newFiles = [...value];
    if (newFiles[index].preview) {
      URL.revokeObjectURL(newFiles[index].preview);
    }
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  const uploadFiles = async () => {
    const uploadedUrls: { url: string; type: string }[] = [];
    const updatedFiles = [...value];

    for (let i = 0; i < updatedFiles.length; i++) {
      const mediaFile = updatedFiles[i];
      if (mediaFile.url || mediaFile.error) continue;

      updatedFiles[i] = { ...mediaFile, uploading: true, progress: 0 };
      onChange([...updatedFiles]);

      try {
        const ext = mediaFile.file.name.split('.').pop();
        const fileName = `${doctorId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

        const { data, error } = await supabase.storage
          .from('doctor-media')
          .upload(fileName, mediaFile.file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;

        const { data: publicUrl } = supabase.storage
          .from('doctor-media')
          .getPublicUrl(data.path);

        updatedFiles[i] = {
          ...mediaFile,
          uploading: false,
          progress: 100,
          url: publicUrl.publicUrl,
        };

        uploadedUrls.push({
          url: publicUrl.publicUrl,
          type: mediaFile.type,
        });
      } catch (error: any) {
        updatedFiles[i] = {
          ...mediaFile,
          uploading: false,
          error: error.message || 'Ошибка загрузки',
        };
      }

      onChange([...updatedFiles]);
    }

    if (onUploadComplete && uploadedUrls.length > 0) {
      onUploadComplete(uploadedUrls);
    }

    return uploadedUrls;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          value.length >= maxFiles && 'opacity-50 cursor-not-allowed'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => value.length < maxFiles && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={value.length >= maxFiles}
        />
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Перетащите файлы сюда или нажмите для выбора
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Максимум {maxFiles} файлов, до {maxSizeMB}MB каждый
        </p>
      </div>

      {/* Preview Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {value.map((mediaFile, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
            >
              {mediaFile.type === 'image' ? (
                <img
                  src={mediaFile.preview || mediaFile.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Video className="w-8 h-8 text-muted-foreground" />
                </div>
              )}

              {/* Uploading Overlay */}
              {mediaFile.uploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Progress value={mediaFile.progress} className="w-3/4" />
                </div>
              )}

              {/* Error Overlay */}
              {mediaFile.error && (
                <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center p-2">
                  <p className="text-xs text-destructive-foreground text-center">
                    {mediaFile.error}
                  </p>
                </div>
              )}

              {/* Success Indicator */}
              {mediaFile.url && !mediaFile.uploading && (
                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}

              {/* Remove Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Type Indicator */}
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 text-xs">
                {mediaFile.type === 'image' ? (
                  <ImageIcon className="w-3 h-3" />
                ) : (
                  <Video className="w-3 h-3" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {value.length > 0 && value.some((f) => !f.url && !f.error) && (
        <Button
          type="button"
          onClick={uploadFiles}
          disabled={value.some((f) => f.uploading)}
        >
          {value.some((f) => f.uploading) ? 'Загрузка...' : 'Загрузить файлы'}
        </Button>
      )}
    </div>
  );
}

// Single image uploader for specific use cases
interface SingleImageUploaderProps {
  doctorId: string;
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  aspectRatio?: string;
}

export function SingleImageUploader({
  doctorId,
  value,
  onChange,
  label,
  aspectRatio = 'aspect-square',
}: SingleImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${doctorId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

      const { data, error } = await supabase.storage
        .from('doctor-media')
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('doctor-media')
        .getPublicUrl(data.path);

      onChange(publicUrl.publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      <div
        className={cn(
          'relative rounded-lg overflow-hidden bg-muted cursor-pointer border-2 border-dashed border-border hover:border-primary/50 transition-colors',
          aspectRatio
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />

        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Загрузить</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
