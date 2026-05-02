import { useState, useRef, useCallback } from 'react';
import * as tus from 'tus-js-client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/api/client';
import { toast } from 'sonner';
import { Upload, X, Pause, Play, FileImage, FileText, Box, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ResumableUploadProps {
  bucketName: string;
  folderPath: string;
  onUploadComplete: (publicUrl: string, fileName: string) => void;
  onCancel?: () => void;
  accept?: string;
  maxSize?: number; // in MB
}

type UploadStatus = 'idle' | 'uploading' | 'paused' | 'complete' | 'error';

export function ResumableUpload({
  bucketName,
  folderPath,
  onUploadComplete,
  onCancel,
  accept = '*',
  maxSize = 500,
}: ResumableUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const uploadRef = useRef<tus.Upload | null>(null);
  const lastProgressRef = useRef<{ time: number; bytes: number }>({ time: 0, bytes: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + ' B/s';
    if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
    return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  };

  const getFileIcon = (file: File) => {
    if (file.name.toLowerCase().endsWith('.stl')) return <Box className="w-8 h-8 text-primary" />;
    if (file.type.startsWith('image/')) return <FileImage className="w-8 h-8 text-blue-500" />;
    return <FileText className="w-8 h-8 text-muted-foreground" />;
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size
    if (selectedFile.size > maxSize * 1024 * 1024) {
      toast.error(`Файл слишком большой. Максимум ${maxSize} MB`);
      return;
    }

    setFile(selectedFile);
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, [maxSize]);

  const startUpload = useCallback(async () => {
    if (!file) return;

    setStatus('uploading');
    setError(null);
    lastProgressRef.current = { time: Date.now(), bytes: 0 };

    try {
      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Необходима авторизация');
      }

      const fileName = `${folderPath}/${Date.now()}_${file.name}`;
      // Use local backend for file uploads instead of Supabase Storage
      const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';

      const upload = new tus.Upload(file, {
        endpoint: `${apiBase}/storage/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: bucketName,
          objectName: fileName,
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks
        onError: (err) => {
          console.error('Upload error:', err);
          setStatus('error');
          setError(err.message || 'Ошибка загрузки');
          toast.error('Ошибка загрузки файла');
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setProgress(percentage);
          
          // Calculate speed
          const now = Date.now();
          const timeDiff = (now - lastProgressRef.current.time) / 1000;
          if (timeDiff > 0.5) {
            const bytesDiff = bytesUploaded - lastProgressRef.current.bytes;
            const speed = bytesDiff / timeDiff;
            setUploadSpeed(speed);
            lastProgressRef.current = { time: now, bytes: bytesUploaded };
          }
        },
        onSuccess: () => {
          setStatus('complete');
          setProgress(100);
          
          // Get public URL
          const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
          onUploadComplete(data.publicUrl, fileName);
          toast.success('Файл успешно загружен');
        },
      });

      uploadRef.current = upload;

      // Check for previous uploads
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    } catch (err: any) {
      console.error('Upload setup error:', err);
      setStatus('error');
      setError(err.message);
      toast.error('Ошибка настройки загрузки');
    }
  }, [file, bucketName, folderPath, onUploadComplete]);

  const pauseUpload = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      setStatus('paused');
    }
  }, []);

  const resumeUpload = useCallback(() => {
    if (uploadRef.current) {
      setStatus('uploading');
      uploadRef.current.start();
    }
  }, []);

  const cancelUpload = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
    }
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onCancel?.();
  }, [onCancel]);

  const removeFile = useCallback(() => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="space-y-4">
      {/* File input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={accept}
        className="hidden"
        id="resumable-upload"
      />

      {!file ? (
        <label
          htmlFor="resumable-upload"
          className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="w-10 h-10" />
            <p className="font-medium">Нажмите для выбора файла</p>
            <p className="text-xs">
              Поддерживается до {maxSize} MB • STL, изображения, PDF
            </p>
          </div>
        </label>
      ) : (
        <div className="border border-border rounded-lg p-4 bg-card">
          {/* File info */}
          <div className="flex items-center gap-3 mb-4">
            {getFileIcon(file)}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatSize(file.size)}
                {status === 'uploading' && uploadSpeed > 0 && (
                  <span className="ml-2">• {formatSpeed(uploadSpeed)}</span>
                )}
              </p>
            </div>
            {status === 'idle' && (
              <Button variant="ghost" size="icon" onClick={removeFile}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {(status === 'uploading' || status === 'paused' || status === 'complete') && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {status === 'complete' ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Загружено
                    </span>
                  ) : status === 'paused' ? (
                    'Приостановлено'
                  ) : (
                    'Загрузка...'
                  )}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error || 'Произошла ошибка'}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {status === 'idle' && (
              <>
                <Button onClick={startUpload} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Начать загрузку
                </Button>
                <Button variant="outline" onClick={cancelUpload}>
                  Отмена
                </Button>
              </>
            )}
            
            {status === 'uploading' && (
              <>
                <Button variant="outline" onClick={pauseUpload} className="flex-1">
                  <Pause className="w-4 h-4 mr-2" />
                  Пауза
                </Button>
                <Button variant="destructive" onClick={cancelUpload}>
                  Отмена
                </Button>
              </>
            )}
            
            {status === 'paused' && (
              <>
                <Button onClick={resumeUpload} className="flex-1">
                  <Play className="w-4 h-4 mr-2" />
                  Продолжить
                </Button>
                <Button variant="destructive" onClick={cancelUpload}>
                  Отмена
                </Button>
              </>
            )}
            
            {status === 'error' && (
              <>
                <Button onClick={startUpload} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Повторить
                </Button>
                <Button variant="outline" onClick={cancelUpload}>
                  Отмена
                </Button>
              </>
            )}
            
            {status === 'complete' && (
              <Button variant="outline" onClick={cancelUpload} className="w-full">
                Загрузить ещё
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
