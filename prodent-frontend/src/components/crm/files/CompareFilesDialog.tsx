import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

interface CompareFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: any[];
  allFiles: any[];
  onFilesChange: (files: any[]) => void;
}

export function CompareFilesDialog({
  open,
  onOpenChange,
  files,
  allFiles,
  onFilesChange,
}: CompareFilesDialogProps) {
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
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-7xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>Сравнение снимков</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 h-full overflow-auto">
          {/* Селекторы файлов */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Снимок 1</Label>
              <Select
                value={files[0]?.id}
                onValueChange={(value) => handleFileChange(0, value)}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="Выберите снимок" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {allFiles.map((file) => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.title} -{" "}
                      {file.visit_date
                        ? format(parseISO(file.visit_date), "d MMM yyyy", { locale: ru })
                        : "Без даты"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Снимок 2</Label>
              <Select
                value={files[1]?.id}
                onValueChange={(value) => handleFileChange(1, value)}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="Выберите снимок" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {allFiles.map((file) => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.title} -{" "}
                      {file.visit_date
                        ? format(parseISO(file.visit_date), "d MMM yyyy", { locale: ru })
                        : "Без даты"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Сравнение изображений */}
          <div className="grid md:grid-cols-2 gap-4 flex-1">
            {files.slice(0, 2).map((file, index) => (
              <div key={file?.id || index} className="space-y-2">
                <div className="bg-slate-700/50 p-2 rounded-lg">
                  <div className="text-sm font-medium">{file?.title || `Снимок ${index + 1}`}</div>
                  {file?.visit_date && (
                    <div className="text-xs text-slate-400">
                      {format(parseISO(file.visit_date), "d MMMM yyyy", { locale: ru })}
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 rounded-lg overflow-hidden h-[500px] relative">
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
                              className="bg-slate-800/90 border-slate-600"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => zoomOut()}
                              className="bg-slate-800/90 border-slate-600"
                            >
                              <ZoomOut className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetTransform()}
                              className="bg-slate-800/90 border-slate-600"
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
                    <div className="flex items-center justify-center h-full text-slate-400">
                      Выберите снимок для сравнения
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
