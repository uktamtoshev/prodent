import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Building2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/contexts/LanguageContext";

interface Clinic {
  id: string;
  name: string;
  city: string;
  district?: string | null;
  address: string;
  phone?: string | null;
  verified?: boolean | null;
  images?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  doctorCount?: number;
}

interface ClinicsMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinics: Clinic[];
}

const createCustomIcon = (verified: boolean = false) => {
  const color = verified ? '#0D9488' : '#6B7280';
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg style="transform: rotate(45deg); width: 16px; height: 16px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
          <path d="M10 6h4"/>
          <path d="M10 10h4"/>
          <path d="M10 14h4"/>
          <path d="M10 18h4"/>
        </svg>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
};

export function ClinicsMapDialog({ open, onOpenChange, clinics }: ClinicsMapDialogProps) {
  const { t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Filter clinics with coordinates
  const clinicsWithCoords = clinics.filter(c => c.latitude && c.longitude);

  useEffect(() => {
    if (!open || !mapRef.current) return;

    // Small delay to ensure dialog is fully rendered
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!mapRef.current) return;

      // Initialize map centered on Tashkent
      const map = L.map(mapRef.current, {
        center: [41.2995, 69.2401],
        zoom: 12,
        zoomControl: true,
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add markers for clinics
      const bounds: L.LatLngTuple[] = [];
      
      clinicsWithCoords.forEach((clinic) => {
        if (clinic.latitude && clinic.longitude) {
          bounds.push([clinic.latitude, clinic.longitude]);
          
          const popupContent = `
            <div style="min-width: 200px; font-family: system-ui, sans-serif;">
              <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                ${clinic.images?.[0] 
                  ? `<img src="${clinic.images[0]}" alt="${clinic.name}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;" />`
                  : `<div style="width: 48px; height: 48px; border-radius: 8px; background: #f3f4f6; display: flex; align-items: center; justify-content: center;">
                      <svg style="width: 24px; height: 24px; color: #9ca3af;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                      </svg>
                    </div>`
                }
                <div>
                  <div style="font-weight: 600; font-size: 14px; color: #1a1a1a;">${clinic.name}</div>
                  ${clinic.verified ? '<span style="font-size: 11px; color: #0D9488; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">✓ Верифицирована</span>' : ''}
                </div>
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                ${clinic.city}${clinic.district ? ', ' + clinic.district : ''}
              </div>
              <div style="font-size: 12px; color: #888; margin-bottom: 8px;">
                ${clinic.address}
              </div>
              ${clinic.doctorCount ? `<div style="font-size: 12px; color: #666; margin-bottom: 8px;">👨‍⚕️ ${clinic.doctorCount} врачей</div>` : ''}
              <div style="display: flex; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #eee;">
                <a href="/clinic/${clinic.id}" style="
                  background: #0D9488;
                  color: white;
                  padding: 6px 12px;
                  border-radius: 6px;
                  font-size: 12px;
                  text-decoration: none;
                  font-weight: 500;
                ">Подробнее</a>
              </div>
            </div>
          `;

          const marker = L.marker([clinic.latitude, clinic.longitude], { 
            icon: createCustomIcon(clinic.verified || false) 
          })
            .addTo(map)
            .bindPopup(popupContent, { maxWidth: 280 });
        }
      });

      // Fit bounds if we have markers
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }

      // Force map to recalculate size
      setTimeout(() => {
        map.invalidateSize();
        setIsMapReady(true);
      }, 100);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setIsMapReady(false);
    };
  }, [open, clinicsWithCoords]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {t('clinics.onMap')} ({clinicsWithCoords.length})
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>
        
        <div className="flex-1 relative">
          <div 
            ref={mapRef} 
            className="absolute inset-0"
            style={{ minHeight: '400px' }}
          />
          {!isMapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <div className="text-muted-foreground">{t('common.loading')}...</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
