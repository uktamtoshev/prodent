import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ClinicAboutMapProps {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export function ClinicAboutMap({ name, address, latitude, longitude }: ClinicAboutMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current).setView([latitude, longitude], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current);

    const customIcon = L.divIcon({
      className: "custom-marker",
      html: '<div style="background: linear-gradient(135deg, #2AB6A6 0%, #1a8a7d 100%); width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 12px rgba(42, 182, 166, 0.4);"></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    L.marker([latitude, longitude], { icon: customIcon })
      .addTo(map.current)
      .bindPopup(`<div class="p-3"><strong class="text-base">${name}</strong><br/><span class="text-muted-foreground">${address}</span></div>`);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [address, latitude, longitude, name]);

  return <div ref={mapContainer} className="h-80 w-full" />;
}
