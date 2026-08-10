import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ClinicMiniMapProps {
  latitude: number;
  longitude: number;
}

export function ClinicMiniMap({ latitude, longitude }: ClinicMiniMapProps) {
  const miniMapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!miniMapRef.current || map.current) return;

    map.current = L.map(miniMapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    }).setView([latitude, longitude], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map.current);

    const customIcon = L.divIcon({
      className: "custom-marker",
      html: '<div style="background: linear-gradient(135deg, #1877f2 0%, #166fe5 100%); width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 8px rgba(24, 119, 242, 0.5);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    L.marker([latitude, longitude], { icon: customIcon }).addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [latitude, longitude]);

  return <div ref={miniMapRef} className="w-full h-full" />;
}
