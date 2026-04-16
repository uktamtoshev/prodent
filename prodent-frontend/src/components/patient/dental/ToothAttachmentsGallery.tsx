import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Image as ImageIcon, 
  FileX2, 
  ZoomIn, 
  Download,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToothAttachmentsGalleryProps {
  patientId: string;
  toothNumber: number;
}

const FILE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  xray: { label: 'Рентген', icon: '🩻' },
  cbct: { label: 'CBCT', icon: '📊' },
  photo: { label: 'Фото', icon: '📷' },
  '3d_scan': { label: '3D скан', icon: '🔬' },
  other: { label: 'Другое', icon: '📎' },
};

export function ToothAttachmentsGallery({ patientId, toothNumber }: ToothAttachmentsGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['tooth-attachments', patientId, toothNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from('tooth_attachments')
        .select(`
          *,
          doctors:doctor_id(
            user_id,
            profiles:user_id(full_name)
          )
        `)
        .eq('patient_id', patientId)
        .contains('tooth_numbers', [toothNumber])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!patientId && !!toothNumber,
  });

  const openViewer = (index: number) => {
    setSelectedImage(index);
    setIsViewerOpen(true);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!attachments || selectedImage === null) return;
    const newIndex = direction === 'prev' 
      ? (selectedImage - 1 + attachments.length) % attachments.length
      : (selectedImage + 1) % attachments.length;
    setSelectedImage(newIndex);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Снимки и фото</span>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="w-24 h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!attachments || attachments.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Снимки и фото</span>
        </div>
        <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
          <FileX2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Нет прикреплённых снимков</p>
        </div>
      </div>
    );
  }

  const currentAttachment = selectedImage !== null ? attachments[selectedImage] : null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Снимки и фото</span>
          <Badge variant="outline" className="text-xs">{attachments.length}</Badge>
        </div>

        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {attachments.map((attachment, index) => {
              const typeInfo = FILE_TYPE_LABELS[attachment.file_type] || FILE_TYPE_LABELS.other;
              const doctorName = attachment.doctors?.profiles?.full_name;

              return (
                <button
                  key={attachment.id}
                  onClick={() => openViewer(index)}
                  className={cn(
                    "relative min-w-[120px] aspect-square rounded-xl overflow-hidden",
                    "border-2 border-transparent hover:border-primary/50",
                    "transition-all duration-200 hover:shadow-lg hover:scale-105",
                    "bg-muted group"
                  )}
                >
                  <img
                    src={attachment.file_url}
                    alt={attachment.description || `Снимок ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>

                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-black/60 text-white border-0 backdrop-blur-sm"
                    >
                      {typeInfo.icon} {typeInfo.label}
                    </Badge>
                  </div>

                  {/* Date */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-xs text-white/90">
                      {format(new Date(attachment.created_at), 'd MMM yy', { locale: ru })}
                    </p>
                    {doctorName && (
                      <p className="text-xs text-white/70 truncate">{doctorName}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Full screen viewer */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0">
          <DialogHeader className="p-4 border-b absolute top-0 left-0 right-0 bg-background/95 backdrop-blur z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                {currentAttachment && (
                  <>
                    <span>{FILE_TYPE_LABELS[currentAttachment.file_type]?.icon}</span>
                    <span>{currentAttachment.description || `Снимок зуба #${toothNumber}`}</span>
                  </>
                )}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {currentAttachment && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(currentAttachment.file_url, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Скачать
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsViewerOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex items-center justify-center p-4 pt-20 pb-20 relative">
            {/* Navigation buttons */}
            {attachments.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/20 hover:bg-black/40 text-white"
                  onClick={() => navigateImage('prev')}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/20 hover:bg-black/40 text-white"
                  onClick={() => navigateImage('next')}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Image */}
            {currentAttachment && (
              <img
                src={currentAttachment.file_url}
                alt={currentAttachment.description || 'Снимок'}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            )}
          </div>

          {/* Footer info */}
          {currentAttachment && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background/95 backdrop-blur">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>
                    {format(new Date(currentAttachment.created_at), 'd MMMM yyyy', { locale: ru })}
                  </span>
                  {currentAttachment.doctors?.profiles?.full_name && (
                    <span>Врач: {currentAttachment.doctors.profiles.full_name}</span>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {selectedImage !== null ? selectedImage + 1 : 0} / {attachments.length}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
