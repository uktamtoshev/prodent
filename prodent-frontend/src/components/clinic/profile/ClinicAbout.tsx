import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Phone, Mail, Globe, Building2, Navigation, Image as ImageIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ClinicAboutProps {
  clinic: any;
}

export function ClinicAbout({ clinic }: ClinicAboutProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !clinic?.latitude || !clinic?.longitude) return;
    if (map.current) return;

    map.current = L.map(mapContainer.current).setView(
      [clinic.latitude, clinic.longitude],
      15
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="background: linear-gradient(135deg, #2AB6A6 0%, #1a8a7d 100%); width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 12px rgba(42, 182, 166, 0.4);"></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    L.marker([clinic.latitude, clinic.longitude], { icon: customIcon })
      .addTo(map.current)
      .bindPopup(`<div class="p-3"><strong class="text-base">${clinic.name}</strong><br/><span class="text-muted-foreground">${clinic.address}</span></div>`);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [clinic]);

  return (
    <div className="space-y-6">
      {/* Description */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            О клинике
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clinic.description ? (
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{clinic.description}</p>
          ) : (
            <p className="text-muted-foreground italic">Описание клиники пока не добавлено</p>
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            Контактная информация
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Адрес</p>
              <p className="text-muted-foreground">
                {clinic.city}{clinic.district && `, ${clinic.district}`}, {clinic.address}
              </p>
            </div>
          </div>

          {clinic.phone && (
            <a 
              href={`tel:${clinic.phone}`}
              className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 hover:bg-primary/10 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Телефон</p>
                <p className="text-primary group-hover:underline">{clinic.phone}</p>
              </div>
            </a>
          )}

          {clinic.email && (
            <a 
              href={`mailto:${clinic.email}`}
              className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 hover:bg-primary/10 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Email</p>
                <p className="text-primary group-hover:underline">{clinic.email}</p>
              </div>
            </a>
          )}

          {clinic.website && (
            <a 
              href={clinic.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 hover:bg-primary/10 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Сайт</p>
                <p className="text-primary group-hover:underline">{clinic.website}</p>
              </div>
            </a>
          )}
        </CardContent>
      </Card>

      {/* Map */}
      {clinic.latitude && clinic.longitude && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Navigation className="w-5 h-5 text-primary" />
              </div>
              Местоположение
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={mapContainer} className="h-80 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Gallery */}
      {clinic.images && clinic.images.length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              Галерея
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {clinic.images.map((image: string, index: number) => (
                <div 
                  key={index} 
                  className="aspect-square rounded-xl overflow-hidden group cursor-pointer border border-border/50"
                >
                  <img 
                    src={image} 
                    alt={`${clinic.name} - ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}