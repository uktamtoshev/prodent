import { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { a11yLabel } from "@/lib/a11y-labels";

type MutationError = { message?: string } | Error | unknown;
type LeafletDefaultIcon = L.Icon.Default & { _getIconUrl?: () => string };
type WorkingHour = { start: string; end: string; enabled: boolean };
type WorkingHourField = keyof WorkingHour;
type WorkingHourValue = string | boolean;

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as LeafletDefaultIcon)._getIconUrl;
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
  const { t } = useLanguage();
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
      toast({ title: t('doctorInlineEdit.saved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      toast({ title: t('doctorInlineEdit.error'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('doctorInlineEdit.bioTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('doctorInlineEdit.bioPlaceholder')}
            className="min-h-[200px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('doctorInlineEdit.cancel')}</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? t('doctorInlineEdit.saving') : t('doctorInlineEdit.save')}
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
  const { t } = useLanguage();
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
      toast({ title: t('doctorInlineEdit.saved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      toast({ title: t('doctorInlineEdit.error'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('doctorInlineEdit.educationTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            placeholder={t('doctorInlineEdit.educationPlaceholder')}
            className="min-h-[150px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('doctorInlineEdit.cancel')}</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? t('doctorInlineEdit.saving') : t('doctorInlineEdit.save')}
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
  const { t } = useLanguage();
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
      toast({ title: t('doctorInlineEdit.saved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      toast({ title: t('doctorInlineEdit.error'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('doctorInlineEdit.certificationsTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCert}
              onChange={(e) => setNewCert(e.target.value)}
              placeholder={t('doctorInlineEdit.certAddPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCert())}
            />
            <Button type="button" variant="outline" onClick={addCert} aria-label={a11yLabel("add")}>
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('doctorInlineEdit.cancel')}</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? t('doctorInlineEdit.saving') : t('doctorInlineEdit.save')}
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
  const { t } = useLanguage();
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
      toast({ title: t('doctorInlineEdit.saved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      toast({ title: t('doctorInlineEdit.error'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('doctorInlineEdit.experienceTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inline-edit-dialogs-field-1">{t('doctorInlineEdit.yearsLabel')}</Label>
            <Input id="inline-edit-dialogs-field-1"
              type="number"
              value={experienceYears}
              onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inline-edit-dialogs-field-2">{t('doctorInlineEdit.specialtyLabel')}</Label>
            <Input id="inline-edit-dialogs-field-2"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder={t('doctorInlineEdit.specialtyPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inline-edit-dialogs-field-3">{t('doctorInlineEdit.categoryLabel')}</Label>
            <Input id="inline-edit-dialogs-field-3"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('doctorInlineEdit.categoryPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('doctorInlineEdit.cancel')}</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? t('doctorInlineEdit.saving') : t('doctorInlineEdit.save')}
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
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const daysMap = useMemo<Record<string, string>>(() => ({
    monday: t('doctorInlineEdit.dayMonday'),
    tuesday: t('doctorInlineEdit.dayTuesday'),
    wednesday: t('doctorInlineEdit.dayWednesday'),
    thursday: t('doctorInlineEdit.dayThursday'),
    friday: t('doctorInlineEdit.dayFriday'),
    saturday: t('doctorInlineEdit.daySaturday'),
    sunday: t('doctorInlineEdit.daySunday'),
  }), [t]);

  const defaultHours = useMemo(() => Object.keys(daysMap).reduce((acc, day) => {
    acc[day] = { start: '09:00', end: '18:00', enabled: day !== 'sunday' };
    return acc;
  }, {} as Record<string, WorkingHour>), [daysMap]);

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
  }, [open, currentHours, defaultHours]);

  const updateDay = (day: string, field: WorkingHourField, value: WorkingHourValue) => {
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
      toast({ title: t('doctorInlineEdit.saved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      toast({ title: t('doctorInlineEdit.error'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('doctorInlineEdit.workingHoursTitle')}</DialogTitle>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('doctorInlineEdit.cancel')}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? t('doctorInlineEdit.saving') : t('doctorInlineEdit.save')}
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
  const { t } = useLanguage();
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
      toast({ title: t('doctorInlineEdit.saved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      toast({ title: t('doctorInlineEdit.error'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('doctorInlineEdit.contactsTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inline-edit-dialogs-field-4">{t('doctorInlineEdit.phoneLabel')}</Label>
            <Input id="inline-edit-dialogs-field-4"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('doctorInlineEdit.phonePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inline-edit-dialogs-field-5">{t('doctorInlineEdit.emailLabel')}</Label>
            <Input id="inline-edit-dialogs-field-5"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('doctorInlineEdit.emailPlaceholder')}
              disabled
            />
            <p className="text-xs text-muted-foreground">{t('doctorInlineEdit.emailHint')}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('doctorInlineEdit.cancel')}</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? t('doctorInlineEdit.saving') : t('doctorInlineEdit.save')}
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
  const { t } = useLanguage();
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
      toast({ title: t('doctorInlineEdit.saved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      setUploading(false);
      toast({ title: t('doctorInlineEdit.error'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('doctorInlineEdit.videoTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inline-edit-dialogs-field-6">{t('doctorInlineEdit.uploadVideo')}</Label>
            <Input id="inline-edit-dialogs-field-6"
              type="file"
              accept="video/*"
              onChange={(e) => {
                setVideoFile(e.target.files?.[0] || null);
                if (e.target.files?.[0]) setVideoUrl('');
              }}
            />
          </div>
          <div className="text-center text-sm text-muted-foreground">{t('doctorInlineEdit.orWord')}</div>
          <div className="space-y-2">
            <Label htmlFor="inline-edit-dialogs-field-7">{t('doctorInlineEdit.videoUrlLabel')}</Label>
            <Input id="inline-edit-dialogs-field-7"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                setVideoFile(null);
              }}
              placeholder={t('doctorInlineEdit.videoUrlPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('doctorInlineEdit.videoUrlHint')}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('doctorInlineEdit.cancel')}</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || uploading}>
              {mutation.isPending || uploading ? t('doctorInlineEdit.saving') : t('doctorInlineEdit.save')}
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
  const { t } = useLanguage();
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
      toast({ title: t('doctorInlineEdit.error'), description: t('doctorInlineEdit.geoNotSupported'), variant: 'destructive' });
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
        const accuracyText = accuracy < 100 ? t('doctorInlineEdit.accuracyHigh') : accuracy < 500 ? t('doctorInlineEdit.accuracyMedium') : t('doctorInlineEdit.accuracyLow');
        toast({
          title: t('doctorInlineEdit.locationDetected'),
          description: `${t('doctorInlineEdit.accuracyHint')}: ${Math.round(accuracy)} ${t('doctorInlineEdit.meters')} (${accuracyText})`
        });
      },
      (error) => {
        setLocating(false);
        let message = t('doctorInlineEdit.geoErrorGeneric');
        if (error.code === 1) message = t('doctorInlineEdit.geoErrorDenied');
        if (error.code === 2) message = t('doctorInlineEdit.geoErrorUnavailable');
        if (error.code === 3) message = t('doctorInlineEdit.geoErrorTimeout');
        toast({ title: t('doctorInlineEdit.error'), description: message, variant: 'destructive' });
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
      toast({ title: t('doctorInlineEdit.searchError'), variant: 'destructive' });
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
      toast({ title: t('doctorInlineEdit.saved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      toast({ title: t('doctorInlineEdit.error'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('doctorInlineEdit.locationTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>{t('doctorInlineEdit.addressSearchLabel')}</Label>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('doctorInlineEdit.addressSearchPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
              />
              <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
                {searching ? t('doctorInlineEdit.searching') : t('doctorInlineEdit.findBtn')}
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
              {locating ? t('doctorInlineEdit.locating') : t('doctorInlineEdit.myLocationBtn')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('doctorInlineEdit.mapHint')}
          </p>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="inline-edit-dialogs-field-8">{t('doctorInlineEdit.addressLabel')}</Label>
            <Input id="inline-edit-dialogs-field-8"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('doctorInlineEdit.addressPlaceholder')}
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inline-edit-dialogs-field-9">{t('doctorInlineEdit.latitudeLabel')}</Label>
              <Input id="inline-edit-dialogs-field-9"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="41.311081"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-edit-dialogs-field-10">{t('doctorInlineEdit.longitudeLabel')}</Label>
              <Input id="inline-edit-dialogs-field-10"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="69.240562"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('doctorInlineEdit.cancel')}</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? t('doctorInlineEdit.saving') : t('doctorInlineEdit.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
