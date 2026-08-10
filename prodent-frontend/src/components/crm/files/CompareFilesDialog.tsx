import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";
import { usePrivatePatientFileUrl } from "./usePrivatePatientFileUrl";

type PatientFile = Tables<"patient_files">;

function PrivateComparisonImage({ file }: { file: PatientFile }) {
  const { url, loading, error, retry } = usePrivatePatientFileUrl(file.file_url);
  if (loading) {
    return <div role="status" className="text-sm text-muted-foreground">Загрузка...</div>;
  }
  if (error || !url) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg bg-status-danger-bg px-3 py-2 text-sm text-status-danger">
        <span>{error || "Файл не загрузился"}</span>
        <Button type="button" variant="outline" className="min-h-11" onClick={retry}>
          Повторить
        </Button>
      </div>
    );
  }
  return <img src={url} alt={file.title} className="h-full w-full object-contain" />;
}

interface CompareFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: PatientFile[];
  allFiles: PatientFile[];
  onFilesChange: (files: PatientFile[]) => void;
}

export function CompareFilesDialog({
  open,
  onOpenChange,
  files,
  allFiles,
  onFilesChange,
}: CompareFilesDialogProps) {
  const { t } = useLanguage();
  const handleFileChange = (index: number, fileId: string) => {
    const newFiles = [...files];
    const selectedFile = allFiles.find((f) => f.id === fileId);
    if (selectedFile) {
      newFiles[index] = selectedFile;
      onFilesChange(newFiles);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-card-foreground max-w-7xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t('crmCompareFiles.compareSnapshots')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 h-full overflow-auto">
          {/* File pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('crmCompareFiles.snapshot1')}</Label>
              <Select
                value={files[0]?.id}
                onValueChange={(value) => handleFileChange(0, value)}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder={t('crmCompareFiles.pickSnapshot')} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {allFiles.map((file) => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.title} -{" "}
                      {file.visit_date
                        ? format(parseISO(file.visit_date), "d MMM yyyy", { locale: ru })
                        : t('crmCompareFiles.noDate')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('crmCompareFiles.snapshot2')}</Label>
              <Select
                value={files[1]?.id}
                onValueChange={(value) => handleFileChange(1, value)}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder={t('crmCompareFiles.pickSnapshot')} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {allFiles.map((file) => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.title} -{" "}
                      {file.visit_date
                        ? format(parseISO(file.visit_date), "d MMM yyyy", { locale: ru })
                        : t('crmCompareFiles.noDate')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image comparison */}
          <div className="grid md:grid-cols-2 gap-4 flex-1">
            {files.slice(0, 2).map((file, index) => (
              <div key={file?.id || index} className="space-y-2">
                <div className="bg-muted/50 p-2 rounded-lg">
                  <div className="text-sm font-medium">{file?.title || `${t('crmCompareFiles.snapshot')} ${index + 1}`}</div>
                  {file?.visit_date && (
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(file.visit_date), "d MMMM yyyy", { locale: ru })}
                    </div>
                  )}
                </div>

                <div className="bg-scrim rounded-lg overflow-hidden h-[500px] relative">
                  {file ? (
                    <TransformWrapper
                      initialScale={1}
                      minScale={0.5}
                      maxScale={4}
                      centerOnInit
                    >
                      {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                          <div className="absolute top-4 left-4 z-10 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => zoomIn()}
                              className="bg-card/90 border-border"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => zoomOut()}
                              className="bg-card/90 border-border"
                            >
                              <ZoomOut className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetTransform()}
                              className="bg-card/90 border-border"
                            >
                              <RotateCw className="w-4 h-4" />
                            </Button>
                          </div>
                          <TransformComponent
                            wrapperStyle={{ width: "100%", height: "100%" }}
                            contentStyle={{ width: "100%", height: "100%" }}
                          >
                            <PrivateComparisonImage file={file} />
                          </TransformComponent>
                        </>
                      )}
                    </TransformWrapper>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {t('crmCompareFiles.pickToCompare')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
