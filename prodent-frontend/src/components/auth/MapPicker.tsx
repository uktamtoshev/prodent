import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

// Default center: Tashkent
const DEFAULT_LAT = 41.2995;
const DEFAULT_LNG = 69.2401;

export function MapPicker({
  latitude,
  longitude,
  onLocationChange,
  disabled = false,
  error,
  className = "",
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const lat = latitude ?? DEFAULT_LAT;
  const lng = longitude ?? DEFAULT_LNG;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Fix default marker icons for leaflet
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: latitude ? 15 : 12,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: !disabled }).addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      onLocationChange(pos.lat, pos.lng);
    });

    if (!disabled) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onLocationChange(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;

    // Resize observer for proper rendering
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker position when lat/lng props change
  useEffect(() => {
    if (markerRef.current && latitude && longitude) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current?.setView([latitude, longitude], 15);
    }
  }, [latitude, longitude]);

  const handleGeolocate = () => {
    if (!navigator.geolocation || disabled) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: geoLat, longitude: geoLng } = pos.coords;
        onLocationChange(geoLat, geoLng);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        Укажите место на карте *
      </Label>
      <div className="relative rounded-xl overflow-hidden border border-border">
        <div
          ref={mapContainerRef}
          className="w-full h-[250px] z-0"
        />
        {/* Geolocate button */}
        <button
          type="button"
          onClick={handleGeolocate}
          disabled={disabled || isLocating}
          className="absolute top-3 right-3 z-[1000] bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-xs font-medium shadow-md hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isLocating ? (
            <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <MapPin className="w-3.5 h-3.5" />
          )}
          Моё местоположение
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Нажмите на карту или перетащите маркер, чтобы указать точное местоположение
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
