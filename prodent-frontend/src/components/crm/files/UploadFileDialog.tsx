import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { createPatientFile } from "@/lib/patient-files-api";
import { toast } from "sonner";
import { Upload, X, FileImage, FileText, Loader2, Box, AlertCircle } from "lucide-react";
import { ResumableUpload } from "./ResumableUpload";
import { useLanguage } from "@/contexts/LanguageContext";

const cleanupUploadedFile = async (bucket: string, path: string) => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error("Patient file cleanup failed; manual storage cleanup is required.");
      return false;
    }
    return true;
  } catch {
    console.error("Patient file cleanup failed; manual storage cleanup is required.");
    return false;
  }
};

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  doctorId?: string;
  onSuccess?: () => void;
  onUploadSuccess?: () => void;
}

export function UploadFileDialog({
  open,
  onOpenChange,
  patientId,
  doctorId,
  onSuccess,
  onUploadSuccess,
}: UploadFileDialogProps) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState("xray");
  const [pendingCleanup, setPendingCleanup] = useState<{
    bucket: string;
    path: string;
  } | null>(null);
  const [cleanupRetrying, setCleanupRetrying] = useState(false);
  const uploadLockRef = useRef(false);

  const finishSuccessfulUpload = async () => {
    const callbacks = [onSuccess, onUploadSuccess].filter(
      (callback): callback is () => void => typeof callback === "function",
    );
    let refreshFailed = false;
    for (const callback of callbacks) {
      try {
        const result: unknown = await Promise.resolve(callback());
        if (
          result &&
          typeof result === "object" &&
          (("isError" in result && result.isError === true) ||
            ("error" in result && result.error))
        ) {
          refreshFailed = true;
        }
      } catch {
        refreshFailed = true;
        console.error("Patient file list refresh failed.");
      }
    }
    if (refreshFailed) {
      toast.warning(`${t('crmFileUpload.uploadSuccess')}. ${t('common.error')}`);
    }
    onOpenChange(false);
    setFile(null);
    setPreview(null);
    setTitle("");
    setDescription("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Create preview for images
      if (selectedFile.type.startsWith("image")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
  };

  const retryCleanup = async () => {
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
  };

  const handleUpload = async () => {
    if (!file || !patientId) {
      toast.error(t('crmFileUpload.selectFileToUpload'));
      return;
    }

    if (uploadLockRef.current) return;
    uploadLockRef.current = true;
    setUploading(true);
    let uploadedPath: string | null = null;
    let recordSaved = false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t('crmFileUpload.authRequired'));
      }

      // Проверяем, является ли пользователь врачом
      let finalDoctorId = doctorId;
      if (!finalDoctorId) {
        const { data: doctorData } = await supabase
          .from("doctors")
          .select("id")
          .eq("user_id", user.id)
          .single();
        finalDoctorId = doctorData?.id || null;
      }

      // Если не врач, проверяем является ли персоналом клиники
      if (!finalDoctorId) {
        const { data: memberData } = await supabase
          .from("clinic_members")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["clinic_admin", "clinic_manager", "assistant"])
          .limit(1);
        
        if (!memberData || memberData.length === 0) {
          throw new Error(t('crmFileUpload.onlyDocsAndStaff'));
        }
      }

      // Загружаем файл в storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${patientId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("patient-files")
        .upload(fileName, file);

      if (uploadError || !uploadData?.path) {
        throw uploadError || new Error(t('crmFileUpload.uploadErrorPrefix'));
      }
      uploadedPath = uploadData.path;
      const privateUrl = `/api/v1/storage/patient-files/${uploadData.path}`;

      // Создаем запись в БД - используем выбранный fileType из селектора
      const { error: dbError } = await createPatientFile({
        patient_id: patientId,
        doctor_id: finalDoctorId, // может быть null для персонала клиники
        uploaded_by: user.id,
        file_url: privateUrl,
        file_type: fileType, // используем значение из селектора, а не MIME-тип файла
        title: title || file.name,
        description,
        thumbnail_url: file.type.startsWith("image") ? privateUrl : null,
        visit_date: new Date().toISOString(),
      });

      if (dbError) throw dbError;
      recordSaved = true;

      toast.success(t('crmFileUpload.uploadSuccess'));
      await finishSuccessfulUpload();
    } catch {
      if (uploadedPath && !recordSaved) {
        const cleanedUp = await cleanupUploadedFile("patient-files", uploadedPath);
        if (!cleanedUp) {
          setPendingCleanup({
            bucket: "patient-files",
            path: uploadedPath,
          });
          toast.warning(t('crmResumableUpload.errorOccurred'));
        }
      }
      console.error("Patient file upload failed.");
      toast.error(t('crmResumableUpload.uploadFileError'));
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
    }
  };

  const handleLargeFileUpload = async (privateUrl: string, fileName: string) => {
    if (uploadLockRef.current) return;
    uploadLockRef.current = true;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t('crmFileUpload.authRequired'));
      }

      // Проверяем, является ли пользователь врачом
      let finalDoctorId = doctorId;
      if (!finalDoctorId) {
        const { data: doctorData } = await supabase
          .from("doctors")
          .select("id")
          .eq("user_id", user.id)
          .single();
        finalDoctorId = doctorData?.id || null;
      }

      // Если не врач, проверяем является ли персоналом клиники
      if (!finalDoctorId) {
        const { data: memberData } = await supabase
          .from("clinic_members")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["clinic_admin", "clinic_manager", "assistant"])
          .limit(1);
        
        if (!memberData || memberData.length === 0) {
          throw new Error(t('crmFileUpload.onlyDocsAndStaff'));
        }
      }

      // Determine file type from extension
      const extension = fileName.toLowerCase().split('.').pop();
      let fileTypeForDb = 'other';
      if (extension === 'stl' || extension === 'obj' || extension === 'ply') {
        fileTypeForDb = 'model_3d';
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
        fileTypeForDb = 'photo';
      } else if (extension === 'pdf' || extension === 'doc' || extension === 'docx') {
        fileTypeForDb = 'document';
      }

      // Создаем запись в БД
      const { error: dbError } = await createPatientFile({
        patient_id: patientId,
        doctor_id: finalDoctorId, // может быть null для персонала клиники
        uploaded_by: user.id,
        file_url: privateUrl,
        file_type: fileTypeForDb,
        title: title || fileName.split('/').pop() || t('crmFileUpload.defaultFileName'),
        description,
        thumbnail_url: null,
        visit_date: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      toast.success(t('crmFileUpload.uploadSuccess'));
      await finishSuccessfulUpload();
    } catch (error: unknown) {
      console.error("Patient file metadata save failed.");
      toast.error(t('crmResumableUpload.uploadFileError'));
      throw error;
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!uploading) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {t('crmFileUpload.title')}
          </DialogTitle>
        </DialogHeader>

        {pendingCleanup && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {t('crmResumableUpload.errorOccurred')}
            </span>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={retryCleanup}
              disabled={cleanupRetrying}
              aria-label={`${t('crmResumableUpload.retry')}: ${t('crmResumableUpload.errorOccurred')}`}
            >
              {cleanupRetrying && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t('crmResumableUpload.retry')}
            </Button>
          </div>
        )}

        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="standard">{t('crmFileUpload.tabStandard')}</TabsTrigger>
            <TabsTrigger value="large" className="flex items-center gap-1">
              <Box className="w-3 h-3" />
              {t('crmFileUpload.tabLarge')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standard" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="medical-file-type">{t('crmFileUpload.fileTypeLabel')}</Label>
              <Select value={fileType} onValueChange={setFileType}>
                <SelectTrigger id="medical-file-type" className="min-h-11 bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="xray">{t('crmFileUpload.typeXray')}</SelectItem>
                  <SelectItem value="ct">{t('crmFileUpload.typeCt')}</SelectItem>
                  <SelectItem value="dicom">{t('crmFileUpload.typeDicom')}</SelectItem>
                  <SelectItem value="photo">{t('crmFileUpload.typePhoto')}</SelectItem>
                  <SelectItem value="photo_before">{t('crmFileUpload.typePhotoBefore')}</SelectItem>
                  <SelectItem value="photo_after">{t('crmFileUpload.typePhotoAfter')}</SelectItem>
                  <SelectItem value="document">{t('crmFileUpload.typeDocument')}</SelectItem>
                  <SelectItem value="other">{t('crmFileUpload.typeOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">{t('crmFileUpload.fileLabel')}</Label>
              {file ? (
                <div className="border border-border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-start gap-3">
                    {preview ? (
                      <img 
                        src={preview} 
                        alt="Preview" 
                        className="w-20 h-20 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center bg-muted rounded">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleRemoveFile}
                      className="min-h-11 min-w-11 shrink-0"
                      aria-label={`${t('common.delete')}: ${file.name}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3">
                      <FileImage className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-sm text-foreground font-medium">
                      {t('crmFileUpload.clickToSelect')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('crmFileUpload.acceptHint')}
                    </p>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="medical-file-title">{t('crmFileUpload.titleLabel')}</Label>
              <Input
                id="medical-file-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('crmFileUpload.titlePlaceholder')}
                className="min-h-11 bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medical-file-description">{t('crmFileUpload.descriptionLabel')}</Label>
              <Textarea
                id="medical-file-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('crmFileUpload.descriptionPlaceholder')}
                className="bg-muted/50 border-border"
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-11 border-border" disabled={uploading}>
                {t('crmFileUpload.cancel')}
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !file || !!pendingCleanup} className="min-h-11">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('crmFileUpload.uploading')}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {t('crmFileUpload.upload')}
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="large" className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Box className="w-4 h-4 text-primary" />
                {t('crmFileUpload.largeHint')}
              </p>
              <p className="mt-1 text-xs">
                {t('crmFileUpload.largeSubHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="large-medical-file-title">{t('crmFileUpload.titleLabel')}</Label>
              <Input
                id="large-medical-file-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('crmFileUpload.titleLargePlaceholder')}
                className="min-h-11 bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="large-medical-file-description">{t('crmFileUpload.descriptionLabel')}</Label>
              <Textarea
                id="large-medical-file-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('crmFileUpload.descriptionLargePlaceholder')}
                className="bg-muted/50 border-border"
                rows={2}
              />
            </div>

            <ResumableUpload
              bucketName="patient-files"
              folderPath={patientId}
              onUploadComplete={handleLargeFileUpload}
              onCancel={() => {}}
              accept=".stl,.obj,.ply,image/*,.pdf"
              maxSize={500}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
