import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { X, Plus, Search, Locate } from 'lucide-react';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});
// Edit Bio Dialog
interface EditBioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  currentBio: string;
}

export function EditBioDialog({ open, onOpenChange, doctorId, currentBio }: EditBioDialogProps) {
  const queryClient = useQueryClient();
  const [bio, setBio] = useState(currentBio || '');

  useEffect(() => {
    if (open) setBio(currentBio || '');
  }, [open, currentBio]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('doctors').update({ bio }).eq('id', doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Сохранено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>О себе</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Расскажите о себе, своём опыте и подходе к работе..."
            className="min-h-[200px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Education Dialog
interface EditEducationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  currentEducation: string;
}

export function EditEducationDialog({ open, onOpenChange, doctorId, currentEducation }: EditEducationDialogProps) {
  const queryClient = useQueryClient();
  const [education, setEducation] = useState(currentEducation || '');

  useEffect(() => {
    if (open) setEducation(currentEducation || '');
  }, [open, currentEducation]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('doctors').update({ education }).eq('id', doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Сохранено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Образование</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            placeholder="Укажите учебные заведения, годы обучения, специальность..."
            className="min-h-[150px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Certifications Dialog
interface EditCertificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  currentCertifications: string[];
}

export function EditCertificationsDialog({ open, onOpenChange, doctorId, currentCertifications }: EditCertificationsDialogProps) {
  const queryClient = useQueryClient();
  const [certifications, setCertifications] = useState<string[]>(currentCertifications || []);
  const [newCert, setNewCert] = useState('');

  useEffect(() => {
    if (open) setCertifications(currentCertifications || []);
  }, [open, currentCertifications]);

  const addCert = () => {
    if (newCert.trim() && !certifications.includes(newCert.trim())) {
      setCertifications([...certifications, newCert.trim()]);
      setNewCert('');
    }
  };

  const removeCert = (cert: string) => {
    setCertifications(certifications.filter((c) => c !== cert));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('doctors').update({ certifications }).eq('id', doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Сохранено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сертификаты</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCert}
              onChange={(e) => setNewCert(e.target.value)}
              placeholder="Добавить сертификат"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCert())}
            />
            <Button type="button" variant="outline" onClick={addCert}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {certifications.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {certifications.map((cert) => (
                <Badge key={cert} variant="secondary" className="gap-1 pr-1">
                  {cert}
                  <button onClick={() => removeCert(cert)} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Experience Dialog
interface EditExperienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  currentData: { experience_years: number; specialty: string; category: string };
}

export function EditExperienceDialog({ open, onOpenChange, doctorId, currentData }: EditExperienceDialogProps) {
  const queryClient = useQueryClient();
  const [experienceYears, setExperienceYears] = useState(currentData.experience_years || 0);
  const [specialty, setSpecialty] = useState(currentData.specialty || '');
  const [category, setCategory] = useState(currentData.category || '');

  useEffect(() => {
    if (open) {
      setExperienceYears(currentData.experience_years || 0);
      setSpecialty(currentData.specialty || '');
      setCategory(currentData.category || '');
    }
  }, [open, currentData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('doctors').update({
        experience_years: experienceYears,
        specialty,
        category: category || null,
      }).eq('id', doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Сохранено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Опыт работы</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Стаж (лет)</Label>
            <Input
              type="number"
              value={experienceYears}
              onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label>Специализация</Label>
            <Input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Например: Стоматолог-терапевт"
            />
          </div>
          <div className="space-y-2">
            <Label>Категория</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Например: Высшая категория"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Working Hours Dialog
interface EditWorkingHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  currentHours: Record<string, { start: string; end: string; enabled?: boolean }> | null;
}

export function EditWorkingHoursDialog({ open, onOpenChange, doctorId, currentHours }: EditWorkingHoursDialogProps) {
  const queryClient = useQueryClient();
  const daysMap: Record<string, string> = {
    monday: 'Понедельник',
    tuesday: 'Вторник',
    wednesday: 'Среда',
    thursday: 'Четверг',
    friday: 'Пятница',
    saturday: 'Суббота',
    sunday: 'Воскресенье',
  };

  const defaultHours = Object.keys(daysMap).reduce((acc, day) => {
    acc[day] = { start: '09:00', end: '18:00', enabled: day !== 'sunday' };
    return acc;
  }, {} as Record<string, { start: string; end: string; enabled: boolean }>);

  const [hours, setHours] = useState(defaultHours);

  useEffect(() => {
    if (open && currentHours) {
      const merged = { ...defaultHours };
      Object.keys(currentHours).forEach((day) => {
        if (merged[day]) {
          merged[day] = { ...currentHours[day], enabled: true };
        }
      });
      setHours(merged);
    }
  }, [open, currentHours]);

  const updateDay = (day: string, field: string, value: any) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const filteredHours = Object.entries(hours).reduce((acc, [day, data]) => {
        if (data.enabled) {
          acc[day] = { start: data.start, end: data.end };
        }
        return acc;
      }, {} as Record<string, { start: string; end: string }>);

      const { error } = await supabase.from('doctors').update({ working_hours: filteredHours }).eq('id', doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Сохранено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>График работы</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {Object.entries(daysMap).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <Switch
                checked={hours[key]?.enabled}
                onCheckedChange={(checked) => updateDay(key, 'enabled', checked)}
              />
              <span className="w-28 text-sm">{label}</span>
              <Input
                type="time"
                value={hours[key]?.start || '09:00'}
                onChange={(e) => updateDay(key, 'start', e.target.value)}
                disabled={!hours[key]?.enabled}
                className="w-28"
              />
              <span>-</span>
              <Input
                type="time"
                value={hours[key]?.end || '18:00'}
                onChange={(e) => updateDay(key, 'end', e.target.value)}
                disabled={!hours[key]?.enabled}
                className="w-28"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Contact Dialog
interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  currentData: { phone: string; email: string };
}

export function EditContactDialog({ open, onOpenChange, profileId, currentData }: EditContactDialogProps) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(currentData.phone || '');
  const [email, setEmail] = useState(currentData.email || '');

  useEffect(() => {
    if (open) {
      setPhone(currentData.phone || '');
      setEmail(currentData.email || '');
    }
  }, [open, currentData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({ phone }).eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Сохранено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Контакты</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Телефон</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@example.com"
              disabled
            />
            <p className="text-xs text-muted-foreground">Email изменяется через настройки аккаунта</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Video Dialog
interface EditVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  currentVideoUrl: string;
}

export function EditVideoDialog({ open, onOpenChange, doctorId, currentVideoUrl }: EditVideoDialogProps) {
  const queryClient = useQueryClient();
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl || '');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setVideoUrl(currentVideoUrl || '');
  }, [open, currentVideoUrl]);

  const mutation = useMutation({
    mutationFn: async () => {
      let finalUrl = videoUrl;

      if (videoFile) {
        setUploading(true);
        const ext = videoFile.name.split('.').pop();
        const fileName = `${doctorId}/video_${Date.now()}.${ext}`;

        const { data, error: uploadError } = await supabase.storage
          .from('doctor-media')
          .upload(fileName, videoFile);

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from('doctor-media')
          .getPublicUrl(data.path);

        finalUrl = publicUrl.publicUrl;
        setUploading(false);
      }

      const { error } = await supabase.from('doctors').update({ video_url: finalUrl || null }).eq('id', doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Сохранено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      setUploading(false);
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Видео-презентация</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Загрузить видео</Label>
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => {
                setVideoFile(e.target.files?.[0] || null);
                if (e.target.files?.[0]) setVideoUrl('');
              }}
            />
          </div>
          <div className="text-center text-sm text-muted-foreground">или</div>
          <div className="space-y-2">
            <Label>Ссылка на видео (YouTube или прямая ссылка)</Label>
            <Input
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                setVideoFile(null);
              }}
              placeholder="https://youtube.com/watch?v=... или https://youtu.be/..."
            />
            <p className="text-xs text-muted-foreground">
              Поддерживаются ссылки YouTube, YouTube Shorts и прямые ссылки на видео
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || uploading}>
              {mutation.isPending || uploading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Location Dialog
interface EditLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  currentData: { address: string | null; latitude: number | null; longitude: number | null };
}

export function EditLocationDialog({ open, onOpenChange, doctorId, currentData }: EditLocationDialogProps) {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState(currentData.address || '');
  const [latitude, setLatitude] = useState(currentData.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(currentData.longitude?.toString() || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  // Get current location via Geolocation API
  const handleLocateMe = async () => {
    if (!navigator.geolocation) {
      toast({ title: 'Ошибка', description: 'Геолокация не поддерживается браузером', variant: 'destructive' });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy; // in meters

        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));

        // Update map
        if (mapInstanceRef.current) {
          // Zoom based on accuracy
          const zoom = accuracy < 100 ? 17 : accuracy < 500 ? 15 : accuracy < 1000 ? 14 : 13;
          mapInstanceRef.current.setView([lat, lng], zoom);
          
          // Update marker
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
          }

          // Show accuracy circle
          if (accuracyCircleRef.current) {
            accuracyCircleRef.current.setLatLng([lat, lng]);
            accuracyCircleRef.current.setRadius(accuracy);
          } else {
            accuracyCircleRef.current = L.circle([lat, lng], {
              radius: accuracy,
              color: '#3b82f6',
              fillColor: '#3b82f680',
              fillOpacity: 0.2,
              weight: 1,
            }).addTo(mapInstanceRef.current);
          }
        }

        // Reverse geocode
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru`
          );
          const data = await response.json();
          if (data.display_name) {
            setAddress(data.display_name);
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error);
        }

        setLocating(false);
        const accuracyText = accuracy < 100 ? 'высокая' : accuracy < 500 ? 'средняя' : 'низкая';
        toast({ 
          title: 'Местоположение определено', 
          description: `Точность: ${Math.round(accuracy)} м (${accuracyText})` 
        });
      },
      (error) => {
        setLocating(false);
        let message = 'Не удалось определить местоположение';
        if (error.code === 1) message = 'Доступ к геолокации запрещён. Разрешите доступ в настройках браузера.';
        if (error.code === 2) message = 'Местоположение недоступно. Попробуйте с мобильного устройства с GPS.';
        if (error.code === 3) message = 'Превышено время ожидания';
        toast({ title: 'Ошибка', description: message, variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (open) {
      setAddress(currentData.address || '');
      setLatitude(currentData.latitude?.toString() || '');
      setLongitude(currentData.longitude?.toString() || '');
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [open, currentData]);

  // Initialize map when dialog opens
  useEffect(() => {
    if (!open) {
      // Cleanup when dialog closes
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        accuracyCircleRef.current = null;
      }
      return;
    }

    let map: L.Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const container = mapRef.current;
      // Only init if container has dimensions
      if (container.offsetWidth === 0 || container.offsetHeight === 0) return;

      const defaultLat = currentData.latitude || 41.311081;
      const defaultLng = currentData.longitude || 69.240562;

      map = L.map(container, {
        center: [defaultLat, defaultLng],
        zoom: 13,
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // Add marker if coordinates exist
      if (currentData.latitude && currentData.longitude) {
        markerRef.current = L.marker([currentData.latitude, currentData.longitude]).addTo(map);
      }

      // Click handler
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else if (mapInstanceRef.current) {
          markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
        }

        // Remove accuracy circle on manual click
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove();
          accuracyCircleRef.current = null;
        }

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru`
          );
          const data = await response.json();
          if (data.display_name) {
            setAddress(data.display_name);
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error);
        }
      });

      // Invalidate size after a short delay
      setTimeout(() => map?.invalidateSize(), 100);
    };

    // Use ResizeObserver to detect when container has dimensions
    if (mapRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            if (!mapInstanceRef.current) {
              initMap();
            } else {
              mapInstanceRef.current.invalidateSize();
            }
          }
        }
      });
      resizeObserver.observe(mapRef.current);
    }

    // Also try after delays as fallback
    const timers = [300, 600, 1000].map(delay => 
      setTimeout(() => {
        if (!mapInstanceRef.current) initMap();
        else mapInstanceRef.current?.invalidateSize();
      }, delay)
    );

    return () => {
      timers.forEach(clearTimeout);
      resizeObserver?.disconnect();
      if (map) {
        map.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        accuracyCircleRef.current = null;
      }
    };
  }, [open, currentData.latitude, currentData.longitude]);

  // Search for address
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=ru`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      toast({ title: 'Ошибка поиска', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  // Select search result
  const selectResult = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    setAddress(result.display_name);
    setLatitude(result.lat);
    setLongitude(result.lon);
    setSearchResults([]);
    setSearchQuery('');

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 15);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
      }
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('doctors').update({
        address: address || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      }).eq('id', doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Сохранено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Локация</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>Поиск адреса</Label>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите адрес для поиска..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
              />
              <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
                {searching ? 'Поиск...' : 'Найти'}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="border border-border rounded-md max-h-40 overflow-y-auto">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-b-0"
                    onClick={() => selectResult(result)}
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="relative">
            <div 
              ref={mapRef} 
              className="h-64 rounded-lg border border-border overflow-hidden"
              style={{ zIndex: 0 }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 z-10 gap-1"
              onClick={handleLocateMe}
              disabled={locating}
            >
              <Locate className="w-4 h-4" />
              {locating ? 'Определение...' : 'Моя локация'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Кликните на карту для выбора локации или нажмите "Моя локация"
          </p>

          {/* Address */}
          <div className="space-y-2">
            <Label>Адрес</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Город, улица, дом"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Широта</Label>
              <Input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="41.311081"
              />
            </div>
            <div className="space-y-2">
              <Label>Долгота</Label>
              <Input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="69.240562"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
