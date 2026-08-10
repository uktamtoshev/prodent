import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface DoctorLocationLeafletMapProps {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

interface LeafletDefaultIconPrototype extends L.Icon.Default {
  _getIconUrl?: unknown;
}

delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export function DoctorLocationLeafletMap({
  latitude,
  longitude,
  name,
  address,
}: DoctorLocationLeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([latitude, longitude], 15);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(`<strong>${name}</strong><br/>${address}`);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [address, latitude, longitude, name]);

  return (
    <div
      ref={mapRef}
      className="h-64 rounded-lg overflow-hidden border border-border"
      style={{ zIndex: 0 }}
    />
  );
}
