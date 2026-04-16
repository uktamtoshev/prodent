import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Loader2, 
  Filter, 
  X, 
  Star, 
  Briefcase, 
  User,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Doctor {
  id: string;
  specialty: string;
  experience_years: number;
  price_from: number;
  rating: number | null;
  latitude?: number | null;
  longitude?: number | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
  clinics: { name: string; city: string; district: string | null; latitude?: number | null; longitude?: number | null } | null;
}

interface DoctorsMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
}

// Specialty options for filter
const specialtyOptions = [
  { value: 'all', label: 'Все специальности' },
  { value: 'Имплантолог', label: 'Имплантолог' },
  { value: 'Терапевт', label: 'Терапевт' },
  { value: 'Хирург', label: 'Хирург' },
  { value: 'Ортодонт', label: 'Ортодонт' },
  { value: 'Ортопед', label: 'Ортопед' },
  { value: 'Пародонтолог', label: 'Пародонтолог' },
  { value: 'Эндодонтист', label: 'Эндодонтист' },
  { value: 'Детский стоматолог', label: 'Детский стоматолог' },
];

// Custom marker icon
const createCustomIcon = (color: string = '#0D9488') => {
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
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
};

export function DoctorsMapDialog({ open, onOpenChange, doctors }: DoctorsMapDialogProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  
  // Filter states
  const [experienceRange, setExperienceRange] = useState<[number, number]>([0, 30]);
  const [minRating, setMinRating] = useState<number>(0);
  const [specialty, setSpecialty] = useState<string>('all');
  const [gender, setGender] = useState<string>('all');

  // Reset filters
  const resetFilters = () => {
    setExperienceRange([0, 30]);
    setMinRating(0);
    setSpecialty('all');
    setGender('all');
  };

  // Filter doctors
  const filteredDoctors = useMemo(() => {
    return doctors.filter(doctor => {
      // Experience filter
      if (doctor.experience_years < experienceRange[0] || doctor.experience_years > experienceRange[1]) {
        return false;
      }
      
      // Rating filter
      if (minRating > 0 && (doctor.rating || 0) < minRating) {
        return false;
      }
      
      // Specialty filter
      if (specialty !== 'all' && !doctor.specialty.toLowerCase().includes(specialty.toLowerCase())) {
        return false;
      }
      
      // Gender filter (infer from name - approximate)
      if (gender !== 'all') {
        const name = (doctor.profiles as any)?.full_name || '';
        const isLikelyFemale = name.endsWith('а') || name.endsWith('я');
        if (gender === 'male' && isLikelyFemale) return false;
        if (gender === 'female' && !isLikelyFemale) return false;
      }
      
      return true;
    });
  }, [doctors, experienceRange, minRating, specialty, gender]);

  // Update markers when filters change
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;
    
    const map = mapInstanceRef.current;
    
    // Remove existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    const bounds: L.LatLngTuple[] = [];
    const customIcon = createCustomIcon();

    filteredDoctors.forEach((doctor) => {
      const lat = doctor.latitude ?? doctor.clinics?.latitude;
      const lng = doctor.longitude ?? doctor.clinics?.longitude;
      
      if (lat && lng) {
        bounds.push([lat, lng]);
        
        const profile = doctor.profiles as any;
        const clinic = doctor.clinics as any;
        const name = profile?.full_name || `Доктор ${doctor.specialty}`;
        const avatar = profile?.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop';
        
        const popupContent = `
          <div style="min-width: 200px; font-family: system-ui, sans-serif;">
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
              <img src="${avatar}" alt="${name}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop'" />
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #1a1a1a;">${name}</div>
                <div style="font-size: 12px; color: #0D9488;">${doctor.specialty}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 6px;">
              <span style="color: #f59e0b;">★</span>
              <span style="font-size: 13px; font-weight: 500;">${doctor.rating || 5.0}</span>
              <span style="color: #888; font-size: 12px;">• ${doctor.experience_years} лет опыта</span>
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              ${clinic?.city || 'Ташкент'}${clinic?.district ? ', ' + clinic.district : ''}
            </div>
            <div style="display: flex; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #eee;">
              <a href="/doctor/${doctor.id}" style="
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
        
        const marker = L.marker([lat, lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(popupContent, { maxWidth: 280 });
        
        markersRef.current.push(marker);
      }
    });

    // Fit bounds if we have markers
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
      }
    }
  }, [filteredDoctors, isMapReady]);

  useEffect(() => {
    if (!open) {
      setIsMapReady(false);
      return;
    }

    // Cleanup previous map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    markersRef.current = [];

    // Wait for dialog to render
    const timer = setTimeout(() => {
      if (!mapRef.current) return;

      try {
        // Default center - Tashkent
        const defaultCenter: [number, number] = [41.2995, 69.2401];
        
        const map = L.map(mapRef.current, {
          center: defaultCenter,
          zoom: 12,
          zoomControl: true,
        });
        
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Invalidate size after render to fix gray tiles issue
        setTimeout(() => {
          map.invalidateSize();
          setIsMapReady(true);
        }, 300);

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const doctorsWithLocation = filteredDoctors.filter(d => 
    (d.latitude && d.longitude) || (d.clinics?.latitude && d.clinics?.longitude)
  );

  const hasActiveFilters = experienceRange[0] > 0 || experienceRange[1] < 30 || minRating > 0 || specialty !== 'all' || gender !== 'all';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Врачи на карте
              <Badge variant="secondary" className="font-normal">
                {doctorsWithLocation.length} из {doctors.filter(d => (d.latitude && d.longitude) || (d.clinics?.latitude && d.clinics?.longitude)).length}
              </Badge>
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex min-h-0">
          {/* Filters Sidebar */}
          <div className="w-72 border-r bg-muted/30 flex-shrink-0 overflow-y-auto">
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-4 py-3 rounded-none border-b">
                  <span className="flex items-center gap-2 font-medium">
                    <Filter className="w-4 h-4" />
                    Фильтры
                    {hasActiveFilters && (
                      <Badge variant="default" className="h-5 px-1.5 text-xs">
                        !
                      </Badge>
                    )}
                  </span>
                  {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="p-4 space-y-6">
                  {/* Experience Range */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      Стаж работы
                    </Label>
                    <div className="px-1">
                      <Slider
                        value={experienceRange}
                        onValueChange={(v) => setExperienceRange(v as [number, number])}
                        min={0}
                        max={30}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{experienceRange[0]} лет</span>
                      <span>{experienceRange[1]}+ лет</span>
                    </div>
                  </div>

                  {/* Rating Filter */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Star className="w-4 h-4 text-muted-foreground" />
                      Минимальный рейтинг
                    </Label>
                    <div className="flex gap-1">
                      {[0, 3, 4, 4.5, 5].map((rating) => (
                        <Button
                          key={rating}
                          variant={minRating === rating ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMinRating(rating)}
                          className="flex-1 px-2"
                        >
                          {rating === 0 ? 'Все' : (
                            <span className="flex items-center gap-1">
                              {rating}
                              <Star className="w-3 h-3 fill-current" />
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Specialty Filter */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      Специализация
                    </Label>
                    <Select value={specialty} onValueChange={setSpecialty}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите специальность" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialtyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender Filter */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Пол врача
                    </Label>
                    <div className="flex gap-2">
                      {[
                        { value: 'all', label: 'Все' },
                        { value: 'male', label: 'Мужской' },
                        { value: 'female', label: 'Женский' },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={gender === option.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setGender(option.value)}
                          className="flex-1"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Reset Filters */}
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Сбросить фильтры
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Results Summary */}
            <div className="p-4 border-t bg-background">
              <div className="text-sm">
                <span className="font-semibold text-foreground">{doctorsWithLocation.length}</span>
                <span className="text-muted-foreground"> врачей найдено</span>
              </div>
              {doctorsWithLocation.length === 0 && hasActiveFilters && (
                <p className="text-xs text-muted-foreground mt-2">
                  Попробуйте изменить фильтры для получения результатов
                </p>
              )}
            </div>
          </div>

          {/* Map Container */}
          <div className="flex-1 relative min-h-0">
            {!isMapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            <div 
              ref={mapRef} 
              className="absolute inset-0 w-full h-full"
              style={{ zIndex: 0 }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
