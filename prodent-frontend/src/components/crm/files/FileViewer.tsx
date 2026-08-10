import { lazy, Suspense, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ZoomIn, ZoomOut, RotateCw, Save, Download, Box, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";
import { openPrivatePatientFile } from "@/lib/patient-cabinet";
import { usePrivatePatientFileUrl } from "./usePrivatePatientFileUrl";
import { updatePatientFile } from "@/lib/patient-files-api";

type PatientFile = Tables<"patient_files">;

const STLViewer = lazy(() =>
  import("./STLViewer").then((module) => ({ default: module.STLViewer }))
);

const STLViewerDialog = lazy(() =>
  import("./STLViewer").then((module) => ({ default: module.STLViewerDialog }))
);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

interface FileViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: PatientFile | null;
  onUpdate: () => void;
}

export function FileViewer({ open, onOpenChange, file, onUpdate }: FileViewerProps) {
  const { t } = useLanguage();
  const [comments, setComments] = useState(file?.comments || "");
  const [saving, setSaving] = useState(false);
  const [fullscreenSTL, setFullscreenSTL] = useState(false);
  const {
    url: previewUrl,
    loading: previewLoading,
    error: previewError,
    retry: retryPreview,
  } = usePrivatePatientFileUrl(file?.file_url, open);

  const handleSaveComments = async () => {
    if (!file) return;

    setSaving(true);
    try {
      const { error } = await updatePatientFile(file.id, { comments });

      if (error) throw error;

      toast.success(t('crmFileViewer.commentsSaved'));
      try {
        await Promise.resolve(onUpdate());
      } catch (refreshError) {
        console.error("File viewer refresh error:", refreshError);
        toast.warning(`${t('crmFileViewer.commentsSaved')}. ${t('common.error')}`);
      }
    } catch (error: unknown) {
      toast.error(`${t('crmFileViewer.saveError')}: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    try {
      await openPrivatePatientFile(file.file_url);
    } catch (error: unknown) {
      toast.error(`${t('crmFileViewer.saveError')}: ${getErrorMessage(error)}`);
    }
  };

  if (!file) return null;

  const isImage = file.file_type?.startsWith("image");
  const isSTL = file.file_type === 'model/stl' ||
                file.file_url?.toLowerCase().endsWith('.stl') ||
                file.title?.toLowerCase().endsWith('.stl');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-foreground max-w-5xl h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {isSTL && <Box className="w-5 h-5 text-primary" />}
                {file.title || t('crmFileViewer.fileFallback')}
              </span>
              <div className="flex gap-2">
                {isSTL && (
                  <Button variant="outline" size="sm" disabled={!previewUrl} onClick={() => setFullscreenSTL(true)} className="border-border">
                    <Maximize2 className="w-4 h-4 mr-2" />
                    {t('crmFileViewer.fullScreen')}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDownload} className="border-border">
                  <Download className="w-4 h-4 mr-2" />
                  {t('crmFileViewer.download')}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-[1fr,300px] gap-4 h-full overflow-hidden">
            {/* Просмотр файла */}
            <div className="bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center relative">
              {previewLoading ? (
                <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
                  {t('crmStlViewer.loading3d')}
                </div>
              ) : previewError ? (
                <div role="alert" className="flex flex-col items-center gap-3 p-4 text-center text-sm text-destructive">
                  <span>{previewError}</span>
                  <Button type="button" variant="outline" className="min-h-11" onClick={retryPreview}>
                    Повторить
                  </Button>
                </div>
              ) : isSTL && previewUrl ? (
                <Suspense
                  fallback={
                    <div className="flex h-full min-h-[400px] w-full items-center justify-center text-sm text-muted-foreground">
                      {t('crmStlViewer.loading3d')}
                    </div>
                  }
                >
                  <STLViewer
                    url={previewUrl}
                    className="w-full h-full min-h-[400px]"
                    onFullscreen={() => setFullscreenSTL(true)}
                  />
                </Suspense>
              ) : isImage && previewUrl ? (
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
                          variant="secondary"
                          onClick={() => zoomIn()}
                          className="bg-background/90 hover:bg-background"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => zoomOut()}
                          className="bg-background/90 hover:bg-background"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => resetTransform()}
                          className="bg-background/90 hover:bg-background"
                        >
                          <RotateCw className="w-4 h-4" />
                        </Button>
                      </div>
                      <TransformComponent
                        wrapperStyle={{ width: "100%", height: "100%" }}
                        contentStyle={{ width: "100%", height: "100%" }}
                      >
                        <img
                          src={previewUrl}
                          alt={file.title}
                          className="w-full h-full object-contain"
                        />
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
              ) : (
                <div className="text-muted-foreground text-center p-8">
                  <p>{t('crmFileViewer.previewUnavailable')}</p>
                  <Button onClick={handleDownload} className="mt-4">
                    {t('crmFileViewer.downloadFile')}
                  </Button>
                </div>
              )}
            </div>

            {/* Панель комментариев */}
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold">{t('crmFileViewer.info')}</h3>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div>
                    <span className="text-muted-foreground/70">{t('crmFileViewer.type')}:</span>{" "}
                    {isSTL ? t('crmFileViewer.threeDModel') : file.file_type}
                  </div>
                  {file.description && (
                    <div>
                      <span className="text-muted-foreground/70">{t('crmFileViewer.description')}:</span> {file.description}
                    </div>
                  )}
                  {file.visit_date && (
                    <div>
                      <span className="text-muted-foreground/70">{t('crmFileViewer.visitDate')}:</span>{" "}
                      {new Date(file.visit_date).toLocaleDateString("ru")}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <h3 className="font-semibold">{t('crmFileViewer.comments')}</h3>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={t('crmFileViewer.addComments')}
                  className="flex-1 bg-muted/50 border-border resize-none"
                />
                <Button onClick={handleSaveComments} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? t('crmFileViewer.saving') : t('crmFileViewer.saveComments')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen STL Viewer */}
      {isSTL && (
        <Suspense fallback={null}>
        <STLViewerDialog
          open={fullscreenSTL}
          onOpenChange={setFullscreenSTL}
          url={previewUrl || ""}
          title={file.title}
        />
        </Suspense>
      )}
    </>
  );
}
