import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, FileText, Eye, ArrowLeftRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";
import { listPatientFiles } from "@/lib/patient-files-api";
import { usePrivatePatientFileUrl } from "./files/usePrivatePatientFileUrl";

interface PatientFilesProps {
  patientId: string;
}

type PatientFile = Tables<"patient_files">;

function PrivateFileThumbnail({ file }: { file: PatientFile }) {
  const { url, loading } = usePrivatePatientFileUrl(
    file.thumbnail_url || file.file_url,
  );
  if (loading) return <Skeleton className="h-full w-full" />;
  if (!url) {
    return <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />;
  }
  return (
    <img
      src={url}
      alt={file.title || ""}
      className="h-full w-full object-cover"
    />
  );
}

const UploadFileDialog = lazy(() =>
  import("./files/UploadFileDialog").then((module) => ({
    default: module.UploadFileDialog,
  })),
);

const FileViewer = lazy(() =>
  import("./files/FileViewer").then((module) => ({
    default: module.FileViewer,
  })),
);

const CompareFilesDialog = lazy(() =>
  import("./files/CompareFilesDialog").then((module) => ({
    default: module.CompareFilesDialog,
  })),
);

export function PatientFiles({ patientId }: PatientFilesProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<PatientFile | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<PatientFile[]>([]);

  const { data: doctor } = useQuery({
    queryKey: ["doctor-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: files, isLoading, isError, refetch } = useQuery({
    queryKey: ["patient-files", patientId],
    queryFn: async () => {
      const { data, error } = await listPatientFiles(patientId);
      if (error) throw error;

      return data || [];
    },
  });

  useEffect(() => {
    setUploadDialogOpen(false);
    setViewerOpen(false);
    setCompareOpen(false);
    setSelectedFile(null);
    setSelectedFiles([]);
  }, [patientId]);

  const handleView = (file: PatientFile) => {
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
          <CardTitle className="text-foreground">{t('crmTopLevel.filesAndSnapshots')}</CardTitle>
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

  if (isError) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
          <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void refetch()}>
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  const imageFiles = files?.filter((f) => f.file_type.startsWith("image")) || [];

  return (
    <>
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ImageIcon className="w-5 h-5" />
              {t('crmTopLevel.filesAndSnapshots')}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {imageFiles.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCompare}
                  className="min-h-11 border-border"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  {t('crmTopLevel.compare')}
                </Button>
              )}
              <Button className="min-h-11" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                {t('crmTopLevel.upload')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {files?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('crmTopLevel.filesNotUploaded')}</p>
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
                    <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded bg-muted">
                      <PrivateFileThumbnail file={file} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="font-medium text-foreground text-sm">
                      {file.title || t('crmTopLevel.noTitle')}
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
                      className="min-h-11 flex-1 border-border"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      {t('crmTopLevel.open')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {uploadDialogOpen && (
        <Suspense fallback={null}>
          <UploadFileDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            patientId={patientId}
            doctorId={doctor?.id || ""}
            onSuccess={refetch}
          />
        </Suspense>
      )}

      {viewerOpen && (
        <Suspense fallback={null}>
          <FileViewer
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            file={selectedFile}
            onUpdate={refetch}
          />
        </Suspense>
      )}

      {compareOpen && (
        <Suspense fallback={null}>
          <CompareFilesDialog
            open={compareOpen}
            onOpenChange={setCompareOpen}
            files={selectedFiles}
            allFiles={imageFiles}
            onFilesChange={setSelectedFiles}
          />
        </Suspense>
      )}
    </>
  );
}
