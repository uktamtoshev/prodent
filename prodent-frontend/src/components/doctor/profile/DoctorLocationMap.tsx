import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation, ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DoctorLocationMapProps {
  clinic: {
    name: string;
    address: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  doctor?: {
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    profile?: {
      full_name?: string | null;
    } | null;
  } | null;
  isOwner?: boolean;
  onEdit?: () => void;
}

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export function DoctorLocationMap({ clinic, doctor, isOwner = false, onEdit }: DoctorLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Prefer doctor's own location, fall back to clinic location
  const locationData = {
    latitude: doctor?.latitude ?? clinic?.latitude,
    longitude: doctor?.longitude ?? clinic?.longitude,
    address: doctor?.address ?? clinic?.address ?? '',
    name: doctor?.profile?.full_name ?? clinic?.name ?? 'Врач',
    city: clinic?.city ?? ''
  };

  const hasCoordinates = locationData.latitude && locationData.longitude;

  useEffect(() => {
    if (!mapRef.current || !hasCoordinates || mapInstanceRef.current) return;

    const lat = locationData.latitude!;
    const lng = locationData.longitude!;

    const map = L.map(mapRef.current).setView([lat, lng], 15);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`<strong>${locationData.name}</strong><br/>${locationData.address}`);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [locationData, hasCoordinates]);

  // Show placeholder if no clinic AND no doctor location
  if (!clinic && !hasCoordinates) {
    return (
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Адрес и локация
          </CardTitle>
          {isOwner && onEdit && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-lg bg-muted flex flex-col items-center justify-center gap-2">
            <MapPin className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Локация не указана</p>
            {isOwner ? (
              <Button variant="outline" size="sm" onClick={onEdit}>
                Указать локацию
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">Локация будет отображена после добавления</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const openInMaps = () => {
    if (hasCoordinates) {
      window.open(
        `https://www.openstreetmap.org/?mlat=${locationData.latitude}&mlon=${locationData.longitude}#map=17/${locationData.latitude}/${locationData.longitude}`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.openstreetmap.org/search?query=${encodeURIComponent(locationData.address + ', ' + locationData.city)}`,
        '_blank'
      );
    }
  };

  const getDirections = () => {
    if (hasCoordinates) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${locationData.latitude},${locationData.longitude}`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationData.address + ', ' + locationData.city)}`,
        '_blank'
      );
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Адрес и локация
        </CardTitle>
        {isOwner && onEdit && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="font-medium">{locationData.name}</p>
          {locationData.address && <p className="text-muted-foreground">{locationData.address}</p>}
          {locationData.city && <p className="text-sm text-muted-foreground">{locationData.city}</p>}
        </div>

        {hasCoordinates ? (
          <div 
            ref={mapRef} 
            className="h-64 rounded-lg overflow-hidden border border-border"
            style={{ zIndex: 0 }}
          />
        ) : (
          <div className="h-64 rounded-lg bg-muted flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Координаты не указаны</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={openInMaps}>
            <ExternalLink className="w-4 h-4" />
            Открыть на карте
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={getDirections}>
            <Navigation className="w-4 h-4" />
            Построить маршрут
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
