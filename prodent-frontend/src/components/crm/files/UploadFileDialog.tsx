import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import { Upload, X, FileImage, FileText, Loader2, Box } from "lucide-react";
import { ResumableUpload } from "./ResumableUpload";

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
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState("xray");

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

  const handleUpload = async () => {
    if (!file || !patientId) {
      toast.error("Выберите файл для загрузки");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Необходимо авторизоваться");
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
          throw new Error("Только врачи и персонал клиники могут загружать файлы");
        }
      }

      // Загружаем файл в storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${patientId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Получаем публичный URL
      const { data: urlData } = supabase.storage
        .from("patient-files")
        .getPublicUrl(fileName);

      // Создаем запись в БД - используем выбранный fileType из селектора
      const { error: dbError } = await supabase.from("patient_files").insert({
        patient_id: patientId,
        doctor_id: finalDoctorId, // может быть null для персонала клиники
        uploaded_by: user.id,
        file_url: urlData.publicUrl,
        file_type: fileType, // используем значение из селектора, а не MIME-тип файла
        title: title || file.name,
        description,
        thumbnail_url: file.type.startsWith("image") ? urlData.publicUrl : null,
        visit_date: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      toast.success("Файл успешно загружен");
      if (onSuccess) onSuccess();
      if (onUploadSuccess) onUploadSuccess();
      onOpenChange(false);
      setFile(null);
      setPreview(null);
      setTitle("");
      setDescription("");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Ошибка загрузки: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLargeFileUpload = async (publicUrl: string, fileName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Необходимо авторизоваться");
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
          throw new Error("Только врачи и персонал клиники могут загружать файлы");
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
      const { error: dbError } = await supabase.from("patient_files").insert({
        patient_id: patientId,
        doctor_id: finalDoctorId, // может быть null для персонала клиники
        uploaded_by: user.id,
        file_url: publicUrl,
        file_type: fileTypeForDb,
        title: title || fileName.split('/').pop() || 'Файл',
        description,
        thumbnail_url: null,
        visit_date: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      if (onSuccess) onSuccess();
      if (onUploadSuccess) onUploadSuccess();
      onOpenChange(false);
      setTitle("");
      setDescription("");
    } catch (error: any) {
      console.error("Database error:", error);
      toast.error("Ошибка сохранения: " + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Загрузить файл
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="standard">Стандартная</TabsTrigger>
            <TabsTrigger value="large" className="flex items-center gap-1">
              <Box className="w-3 h-3" />
              3D модели (до 500 MB)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standard" className="space-y-4">
            <div className="space-y-2">
              <Label>Тип файла</Label>
              <Select value={fileType} onValueChange={setFileType}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="xray">Рентген</SelectItem>
                  <SelectItem value="ct">КТ-снимок</SelectItem>
                  <SelectItem value="dicom">DICOM</SelectItem>
                  <SelectItem value="photo">Фото</SelectItem>
                  <SelectItem value="photo_before">Фото (до)</SelectItem>
                  <SelectItem value="photo_after">Фото (после)</SelectItem>
                  <SelectItem value="document">Документ</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Файл *</Label>
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
                      className="shrink-0"
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
                      Нажмите для выбора файла
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Изображения, PDF, Word (макс. 20 MB)
                    </p>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название файла..."
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Добавьте описание или комментарии..."
                className="bg-muted/50 border-border"
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
                Отмена
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !file}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Загрузить
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="large" className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Box className="w-4 h-4 text-primary" />
                Для загрузки больших 3D файлов (STL) используйте эту вкладку
              </p>
              <p className="mt-1 text-xs">
                Поддержка файлов до 500 MB с возможностью паузы и продолжения загрузки
              </p>
            </div>

            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название 3D модели..."
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Добавьте описание модели..."
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
