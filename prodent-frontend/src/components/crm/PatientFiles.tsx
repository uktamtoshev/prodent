import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, FileText, Eye, ArrowLeftRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import { UploadFileDialog } from "./files/UploadFileDialog";
import { FileViewer } from "./files/FileViewer";
import { CompareFilesDialog } from "./files/CompareFilesDialog";
import { useAuth } from "@/contexts/AuthContext";

interface PatientFilesProps {
  patientId: string;
}

export function PatientFiles({ patientId }: PatientFilesProps) {
  const { user } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);

  const { data: doctor } = useQuery({
    queryKey: ["doctor-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ["patient-files", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patient_files")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      return data || [];
    },
  });

  const handleView = (file: any) => {
    setSelectedFile(file);
    setViewerOpen(true);
  };

  const handleCompare = () => {
    const imageFiles = files?.filter((f) => f.file_type.startsWith("image")) || [];
    setSelectedFiles(imageFiles.slice(0, 2));
    setCompareOpen(true);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image")) return <ImageIcon className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="text-foreground">Снимки и файлы</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const imageFiles = files?.filter((f) => f.file_type.startsWith("image")) || [];

  return (
    <>
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ImageIcon className="w-5 h-5" />
              Снимки и файлы
            </CardTitle>
            <div className="flex gap-2">
              {imageFiles.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCompare}
                  className="border-border"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Сравнить
                </Button>
              )}
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Загрузить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {files?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Файлы не загружены</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {files?.map((file) => (
                <div
                  key={file.id}
                  className="border border-border/50 rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {getFileIcon(file.file_type)}
                      <span className="text-xs">{file.file_type.split("/")[1]?.toUpperCase()}</span>
                    </div>
                  </div>

                  {file.file_type.startsWith("image") && file.thumbnail_url && (
                    <div className="mb-3 aspect-video bg-muted rounded overflow-hidden">
                      <img
                        src={file.thumbnail_url}
                        alt={file.title || "Снимок"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="font-medium text-foreground text-sm">
                      {file.title || "Без названия"}
                    </div>
                    {file.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{file.description}</p>
                    )}
                    {file.visit_date && (
                      <p className="text-xs text-muted-foreground/70">
                        {format(parseISO(file.visit_date), "d MMM yyyy", { locale: ru })}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(file)}
                      className="flex-1 border-border"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Открыть
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <UploadFileDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        patientId={patientId}
        doctorId={doctor?.id || ""}
        onSuccess={refetch}
      />

      <FileViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        file={selectedFile}
        onUpdate={refetch}
      />

      <CompareFilesDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        files={selectedFiles}
        allFiles={imageFiles}
        onFilesChange={setSelectedFiles}
      />
    </>
  );
}
