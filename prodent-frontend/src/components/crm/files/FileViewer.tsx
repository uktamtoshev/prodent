import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ZoomIn, ZoomOut, RotateCw, Save, Download, Box, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { STLViewer, STLViewerDialog } from "./STLViewer";

interface FileViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: any;
  onUpdate: () => void;
}

export function FileViewer({ open, onOpenChange, file, onUpdate }: FileViewerProps) {
  const [comments, setComments] = useState(file?.comments || "");
  const [saving, setSaving] = useState(false);
  const [fullscreenSTL, setFullscreenSTL] = useState(false);

  const handleSaveComments = async () => {
    if (!file) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("patient_files")
        .update({ comments })
        .eq("id", file.id);

      if (error) throw error;

      toast.success("Комментарии сохранены");
      onUpdate();
    } catch (error: any) {
      toast.error("Ошибка сохранения: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!file) return;
    window.open(file.file_url, "_blank");
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
                {file.title || "Файл"}
              </span>
              <div className="flex gap-2">
                {isSTL && (
                  <Button variant="outline" size="sm" onClick={() => setFullscreenSTL(true)} className="border-border">
                    <Maximize2 className="w-4 h-4 mr-2" />
                    Полный экран
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDownload} className="border-border">
                  <Download className="w-4 h-4 mr-2" />
                  Скачать
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-[1fr,300px] gap-4 h-full overflow-hidden">
            {/* Просмотр файла */}
            <div className="bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center relative">
              {isSTL ? (
                <STLViewer 
                  url={file.file_url} 
                  className="w-full h-full min-h-[400px]"
                  onFullscreen={() => setFullscreenSTL(true)}
                />
              ) : isImage ? (
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
                          src={file.file_url}
                          alt={file.title}
                          className="w-full h-full object-contain"
                        />
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
              ) : (
                <div className="text-muted-foreground text-center p-8">
                  <p>Предварительный просмотр недоступен для этого типа файла</p>
                  <Button onClick={handleDownload} className="mt-4">
                    Скачать файл
                  </Button>
                </div>
              )}
            </div>

            {/* Панель комментариев */}
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Информация</h3>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div>
                    <span className="text-muted-foreground/70">Тип:</span>{" "}
                    {isSTL ? '3D модель (STL)' : file.file_type}
                  </div>
                  {file.description && (
                    <div>
                      <span className="text-muted-foreground/70">Описание:</span> {file.description}
                    </div>
                  )}
                  {file.visit_date && (
                    <div>
                      <span className="text-muted-foreground/70">Дата визита:</span>{" "}
                      {new Date(file.visit_date).toLocaleDateString("ru")}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <h3 className="font-semibold">Комментарии</h3>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Добавьте комментарии к файлу..."
                  className="flex-1 bg-muted/50 border-border resize-none"
                />
                <Button onClick={handleSaveComments} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Сохранение..." : "Сохранить комментарии"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen STL Viewer */}
      {isSTL && (
        <STLViewerDialog
          open={fullscreenSTL}
          onOpenChange={setFullscreenSTL}
          url={file.file_url}
          title={file.title}
        />
      )}
    </>
  );
}
