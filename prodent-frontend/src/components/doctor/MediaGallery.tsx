import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Video, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface Media {
  id: string;
  type: string;
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  before_after: boolean;
}

interface MediaGalleryProps {
  media: Media[];
}

const MediaGallery = ({ media }: MediaGalleryProps) => {
  const { t } = useLanguage();
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  return (
    <>
      {/* Vertical TikTok-style scroll gallery */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {media.map((item) => (
          <div
            key={item.id}
            className="relative rounded-xl overflow-hidden cursor-pointer group"
            onClick={() => setSelectedMedia(item)}
          >
            {/* Media Item */}
            <div className="relative aspect-[9/16] max-h-[500px]">
              {item.type === "video" ? (
                <video
                  src={item.url}
                  poster={item.thumbnail_url || undefined}
                  className="w-full h-full object-cover"
                  muted
                  loop
                />
              ) : (
                <img
                  src={item.url}
                  alt={item.title || t('doctorMediaGallery.doctorWork')}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  {item.title && (
                    <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                  )}
                  {item.description && (
                    <p className="text-white/90 text-sm">{item.description}</p>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="absolute top-4 right-4 flex gap-2">
                {item.before_after && (
                  <Badge className="border-0 bg-primary text-primary-foreground">{t('doctorMediaGallery.beforeAfter')}</Badge>
                )}
                <Badge variant="secondary" className="bg-black/50 text-white border-0">
                  {item.type === "video" ? (
                    <><Video className="w-3 h-3 mr-1" />{t('doctorMediaGallery.video')}</>
                  ) : (
                    <><ImageIcon className="w-3 h-3 mr-1" />{t('doctorMediaGallery.photo')}</>
                  )}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Media Detail Dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {selectedMedia && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMedia.title || t('doctorMediaGallery.doctorWork')}</DialogTitle>
              </DialogHeader>
              <div className="relative">
                {selectedMedia.type === "video" ? (
                  <video
                    src={selectedMedia.url}
                    controls
                    autoPlay
                    className="w-full rounded-lg"
                  />
                ) : (
                  <img
                    src={selectedMedia.url}
                    alt={selectedMedia.title || "Работа врача"}
                    className="w-full rounded-lg"
                  />
                )}
              </div>
              {selectedMedia.description && (
                <p className="text-muted-foreground">{selectedMedia.description}</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: hsl(var(--muted));
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--primary));
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.8);
        }
      `}</style>
    </>
  );
};

export default MediaGallery;
