import { useState, useRef, useCallback } from 'react';
import * as tus from 'tus-js-client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, X, Pause, Play, FileImage, FileText, Box, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { a11yLabel } from "@/lib/a11y-labels";

interface ResumableUploadProps {
  bucketName: string;
  folderPath: string;
  onUploadComplete: (
    privateUrl: string,
    fileName: string,
  ) => void | Promise<void>;
  onCancel?: () => void;
  accept?: string;
  maxSize?: number; // in MB
}

type UploadStatus = 'idle' | 'uploading' | 'paused' | 'complete' | 'error';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const cleanupUploadedFile = async (bucket: string, path: string) => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error('Patient file cleanup failed; manual storage cleanup is required.');
      return false;
    }
    return true;
  } catch {
    console.error('Patient file cleanup failed; manual storage cleanup is required.');
    return false;
  }
};

export function ResumableUpload({
  bucketName,
  folderPath,
  onUploadComplete,
  onCancel,
  accept = '*',
  maxSize = 500,
}: ResumableUploadProps) {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingCleanup, setPendingCleanup] = useState<{
    bucket: string;
    path: string;
  } | null>(null);
  const [cleanupRetrying, setCleanupRetrying] = useState(false);
  
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
    if (file.type.startsWith('image/')) return <FileImage className="w-8 h-8 text-status-info" />;
    return <FileText className="w-8 h-8 text-muted-foreground" />;
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size
    if (selectedFile.size > maxSize * 1024 * 1024) {
      toast.error(`${t('crmResumableUpload.fileTooLarge')} ${maxSize} MB`);
      return;
    }

    setFile(selectedFile);
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, [maxSize, t]);

  const startUpload = useCallback(async () => {
    if (!file || pendingCleanup) return;

    setStatus('uploading');
    setError(null);
    lastProgressRef.current = { time: Date.now(), bytes: 0 };

    try {
      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(t('crmResumableUpload.authRequired'));
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
          console.error('Patient resumable upload failed.');
          setStatus('error');
          setError(err.message || t('crmResumableUpload.uploadError'));
          toast.error(t('crmResumableUpload.uploadFileError'));
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
        onSuccess: async () => {
          const privateUrl = `/api/v1/storage/${bucketName}/${fileName}`;
          try {
            await onUploadComplete(privateUrl, fileName);
            setStatus('complete');
            setProgress(100);
            toast.success(t('crmResumableUpload.uploadSuccess'));
          } catch {
            const cleanedUp = await cleanupUploadedFile(bucketName, fileName);
            if (!cleanedUp) {
              setPendingCleanup({ bucket: bucketName, path: fileName });
              toast.warning(t('crmResumableUpload.errorOccurred'));
            }
            setStatus('error');
            setError(t('crmResumableUpload.uploadFileError'));
            toast.error(t('crmResumableUpload.uploadFileError'));
          }
        },
      });

      uploadRef.current = upload;

      // Check for previous uploads
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    } catch (err: unknown) {
      console.error('Patient resumable upload setup failed.');
      setStatus('error');
      setError(getErrorMessage(err));
      toast.error(t('crmResumableUpload.uploadSetupError'));
    }
  }, [file, bucketName, folderPath, onUploadComplete, pendingCleanup, t]);

  const retryCleanup = useCallback(async () => {
    if (!pendingCleanup || cleanupRetrying) return;

    setCleanupRetrying(true);
    const cleanedUp = await cleanupUploadedFile(
      pendingCleanup.bucket,
      pendingCleanup.path,
    );
    if (cleanedUp) {
      setPendingCleanup(null);
    } else {
      toast.warning(t('crmResumableUpload.errorOccurred'));
    }
    setCleanupRetrying(false);
  }, [cleanupRetrying, pendingCleanup, t]);

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
            <p className="font-medium">{t('crmResumableUpload.clickToSelect')}</p>
            <p className="text-xs">
              {t('crmResumableUpload.supportsUpTo')} {maxSize} MB • {t('crmResumableUpload.stlImagesPdf')}
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
              <Button variant="ghost" size="icon" onClick={removeFile} aria-label={a11yLabel("close")}>
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
                    <span className="flex items-center gap-1 text-status-success">
                      <CheckCircle className="w-4 h-4" />
                      {t('crmResumableUpload.uploaded')}
                    </span>
                  ) : status === 'paused' ? (
                    t('crmResumableUpload.paused')
                  ) : (
                    t('crmResumableUpload.uploading')
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
              {error || t('crmResumableUpload.errorOccurred')}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {status === 'idle' && (
              <>
                <Button onClick={startUpload} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  {t('crmResumableUpload.startUpload')}
                </Button>
                <Button variant="outline" onClick={cancelUpload}>
                  {t('crmResumableUpload.cancel')}
                </Button>
              </>
            )}

            {status === 'uploading' && (
              <>
                <Button variant="outline" onClick={pauseUpload} className="flex-1">
                  <Pause className="w-4 h-4 mr-2" />
                  {t('crmResumableUpload.pauseBtn')}
                </Button>
                <Button variant="destructive" onClick={cancelUpload}>
                  {t('crmResumableUpload.cancel')}
                </Button>
              </>
            )}

            {status === 'paused' && (
              <>
                <Button onClick={resumeUpload} className="flex-1">
                  <Play className="w-4 h-4 mr-2" />
                  {t('crmResumableUpload.resumeBtn')}
                </Button>
                <Button variant="destructive" onClick={cancelUpload}>
                  {t('crmResumableUpload.cancel')}
                </Button>
              </>
            )}

            {status === 'error' && (
              <>
                <Button
                  onClick={pendingCleanup ? retryCleanup : startUpload}
                  className="flex-1"
                  disabled={cleanupRetrying}
                  aria-label={
                    pendingCleanup
                      ? `${t('crmResumableUpload.retry')}: ${t('crmResumableUpload.errorOccurred')}`
                      : undefined
                  }
                >
                  {cleanupRetrying ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {t('crmResumableUpload.retry')}
                </Button>
                {!pendingCleanup && (
                  <Button variant="outline" onClick={cancelUpload}>
                    {t('crmResumableUpload.cancel')}
                  </Button>
                )}
              </>
            )}

            {status === 'complete' && (
              <Button variant="outline" onClick={cancelUpload} className="w-full">
                {t('crmResumableUpload.uploadMore')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
