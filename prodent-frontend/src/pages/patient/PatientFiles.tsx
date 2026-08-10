import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Image as ImageIcon,
  Loader2,
  Download,
  Eye,
  FolderOpen,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { openPrivatePatientFile } from "@/lib/patient-cabinet";
import { createPatientFile, listPatientFiles } from "@/lib/patient-files-api";

interface PatientFile {
  id: string;
  file_url: string;
  file_type: string;
  description: string | null;
  created_at: string;
  title: string;
}

const PatientFiles = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const uploadLockRef = useRef(false);
  const loadRequestRef = useRef(0);

  const fetchFiles = useCallback(async (
    options: { preserveOnError?: boolean } = {},
  ): Promise<boolean> => {
    const userId = user?.id;
    if (!userId) return false;
    const requestId = ++loadRequestRef.current;
    if (!options.preserveOnError) setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await listPatientFiles(userId);
      if (error) throw error;

      if (requestId !== loadRequestRef.current) return false;
      setFiles(data || []);
      setRefreshWarning(null);
      return true;
    } catch (error) {
      if (requestId !== loadRequestRef.current) return false;
      console.error('Error fetching files:', error);
      const message =
        error instanceof Error ? error.message : "Failed to load files";
      if (options.preserveOnError) {
        setRefreshWarning(message);
      } else {
        setLoadError(message);
      }
      return false;
    } finally {
      if (
        requestId === loadRequestRef.current &&
        !options.preserveOnError
      ) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      void fetchFiles();
    } else {
      loadRequestRef.current += 1;
      setFiles([]);
      setLoading(false);
    }
    return () => {
      loadRequestRef.current += 1;
    };
  }, [user?.id, fetchFiles]);

  const uploadDocument = async (file: File) => {
    if (!user?.id || uploadLockRef.current) return;
    uploadLockRef.current = true;
    setUploading(true);
    setRefreshWarning(null);
    let uploadedPath: string | null = null;
    let recordSaved = false;
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/patient-files/${crypto.randomUUID()}-${safeName}`;
      const { data: uploaded, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (uploadError || !uploaded?.path) {
        throw new Error(uploadError?.message || "Upload failed");
      }
      uploadedPath = uploaded.path;

      const privateUrl = `/api/v1/storage/documents/${uploaded.path}`;
      const { error: recordError } = await createPatientFile({
        patient_id: user.id,
        uploaded_by: user.id,
        file_url: privateUrl,
        file_type: "document",
        title: file.name,
      });
      if (recordError) throw recordError;
      recordSaved = true;

      toast.success(t("patientCabinet.fileUploaded"));
      await fetchFiles({ preserveOnError: true });
    } catch (error) {
      if (uploadedPath && !recordSaved) {
        void supabase.storage.from("documents").remove([uploadedPath]);
      }
      toast.error(
        error instanceof Error ? error.message : t("patientCabinet.fileUploadError"),
      );
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
    }
  };

  const openFile = async (file: PatientFile) => {
    try {
      await openPrivatePatientFile(file.file_url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("patientCabinet.fileOpenError"),
      );
    }
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'xray': return '📷';
      case 'ct': return '🔬';
      case 'dicom': return '🩻';
      case 'photo': return '🖼️';
      case 'photo_before': return '📸';
      case 'photo_after': return '📸';
      case 'model_3d': return '🎲';
      case 'document': return '📄';
      default: return '📁';
    }
  };

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'xray': return t("patientCabinet.typeXray");
      case 'ct': return t("patientCabinet.typeCt");
      case 'dicom': return t("patientCabinet.typeDicom");
      case 'photo': return t("patientCabinet.typePhoto");
      case 'photo_before': return t("patientCabinet.typePhotoBefore");
      case 'photo_after': return t("patientCabinet.typePhotoAfter");
      case 'model_3d': return t("patientCabinet.typeModel3d");
      case 'document': return t("patientCabinet.typeDocument");
      default: return t("patientCabinet.typeOther");
    }
  };

  const scans = files.filter(f => ['xray', 'ct', 'dicom'].includes(f.file_type));
  const photos = files.filter(f => ['photo', 'photo_before', 'photo_after'].includes(f.file_type));
  const documents = files.filter(f => !['xray', 'ct', 'dicom', 'photo', 'photo_before', 'photo_after'].includes(f.file_type));

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  if (loadError) {
    return (
      <PatientLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-4 text-center" role="alert">
          <p className="text-sm font-medium text-destructive">
            {t("common.error")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void fetchFiles()}
          >
            Повторить
          </Button>
        </div>
      </PatientLayout>
    );
  }

  const FileCard = ({ file }: { file: PatientFile }) => (
    <Card className="border-border/50 hover:border-primary/20 transition-all group overflow-hidden">
      <CardContent className="p-0">
        <div className="aspect-square bg-muted/30 flex items-center justify-center relative">
          <span className="text-5xl">{getFileTypeIcon(file.file_type)}</span>
          
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <Button size="sm" variant="secondary" onClick={() => void openFile(file)}>
              <Eye className="w-4 h-4 mr-1" />
              {t("patientCabinet.openFile")}
            </Button>
          </div>
        </div>
        
        <div className="p-3 space-y-2">
          <Badge variant="outline" className="text-xs">
            {getFileTypeLabel(file.file_type)}
          </Badge>
          <p className="text-sm font-medium truncate" title={file.title}>
            {file.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(file.created_at), 'd MMM yyyy', { locale: ru })}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ icon: Icon, title, description }: { icon: LucideIcon, title: string, description: string }) => (
    <Card className="border-border/50">
      <CardContent className="text-center py-12">
        <Icon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <PatientLayout>
      <div className="min-w-0 space-y-6 p-3 sm:p-6 lg:p-8">
        {refreshWarning && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            role="status"
            aria-live="polite"
          >
            <span>{t("patientCabinet.fileUploaded")} — {t("common.error")}</span>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 bg-white"
              onClick={() => void fetchFiles({ preserveOnError: true })}
            >
              Повторить
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-foreground">{t("patientCabinet.myFiles")}</h1>
            <p className="text-muted-foreground mt-1">{t("patientCabinet.myFilesDesc")}</p>
          </div>
          <Button asChild disabled={uploading} className="min-h-11">
            <label className="cursor-pointer">
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {t("patientCabinet.uploadDocument")}
              <input
                className="sr-only"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadDocument(file);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>

        <Tabs defaultValue="scans" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="scans">🦷 {t("patientCabinet.filesTabScans")} ({scans.length})</TabsTrigger>
            <TabsTrigger value="photos">📸 {t("patientCabinet.filesTabPhotos")} ({photos.length})</TabsTrigger>
            <TabsTrigger value="documents">📄 {t("patientCabinet.filesTabDocuments")} ({documents.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scans">
            {scans.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {scans.map(file => <FileCard key={file.id} file={file} />)}
              </div>
            ) : (
              <EmptyState icon={FolderOpen} title={t("patientCabinet.noScans")} description={t("patientCabinet.noScansDesc")} />
            )}
          </TabsContent>

          <TabsContent value="photos">
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map(file => <FileCard key={file.id} file={file} />)}
              </div>
            ) : (
              <EmptyState icon={ImageIcon} title={t("patientCabinet.noPhotos")} description={t("patientCabinet.noPhotosDesc")} />
            )}
          </TabsContent>

          <TabsContent value="documents">
            {documents.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {documents.map(file => <FileCard key={file.id} file={file} />)}
              </div>
            ) : (
              <EmptyState icon={FileText} title={t("patientCabinet.noDocuments")} description={t("patientCabinet.noDocumentsDesc")} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PatientLayout>
  );
};

export default PatientFiles;
