import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Loader2,
  User,
  GraduationCap,
  Clock,
  Award,
  X,
  Plus,
  Image as ImageIcon,
  Lock,
} from 'lucide-react';

interface EditDoctorProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: {
    id: string;
    specialty?: string | null;
    category?: string | null;
    bio?: string | null;
    education?: string | null;
    experience_years?: number | null;
    price_from?: number | null;
    cover_url?: string | null;
    video_url?: string | null;
    certifications?: string[] | null;
    working_hours?: Record<string, { start: string; end: string }> | null;
  };
  profile: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  };
}

interface ProfileMutationError {
  message?: string;
}

type ProfileUpdate = {
  phone: string;
  avatar_url: string;
  full_name?: string;
};

export function EditDoctorProfileDialog({
  open,
  onOpenChange,
  doctor,
  profile,
}: EditDoctorProfileDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAdmin();

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Doctor fields
  const [specialty, setSpecialty] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [education, setEducation] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [priceFrom, setPriceFrom] = useState(0);
  const [coverImage, setCoverImage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newCertification, setNewCertification] = useState('');

  // Working hours
  const [workingHours, setWorkingHours] = useState<Record<string, { start: string; end: string; enabled: boolean }>>({
    monday: { start: '09:00', end: '18:00', enabled: true },
    tuesday: { start: '09:00', end: '18:00', enabled: true },
    wednesday: { start: '09:00', end: '18:00', enabled: true },
    thursday: { start: '09:00', end: '18:00', enabled: true },
    friday: { start: '09:00', end: '18:00', enabled: true },
    saturday: { start: '09:00', end: '14:00', enabled: false },
    sunday: { start: '09:00', end: '14:00', enabled: false },
  });

  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (doctor && profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatar_url || '');
      setSpecialty(doctor.specialty || '');
      setCategory(doctor.category || '');
      setBio(doctor.bio || '');
      setEducation(doctor.education || '');
      setExperienceYears(doctor.experience_years || 0);
      setPriceFrom(doctor.price_from || 0);
      setCoverImage(doctor.cover_url || '');
      setVideoUrl(doctor.video_url || '');
      setCertifications(doctor.certifications || []);

      if (doctor.working_hours) {
        const wh = doctor.working_hours as Record<string, { start: string; end: string }>;
        setWorkingHours((prev) => {
          const updated = { ...prev };
          Object.keys(wh).forEach((day) => {
            if (updated[day]) {
              updated[day] = { ...wh[day], enabled: true };
            }
          });
          return updated;
        });
      }
    }
  }, [doctor, profile]);

  const daysMap: Record<string, string> = useMemo(() => ({
    monday: t('doctorEditProfile.monday'),
    tuesday: t('doctorEditProfile.tuesday'),
    wednesday: t('doctorEditProfile.wednesday'),
    thursday: t('doctorEditProfile.thursday'),
    friday: t('doctorEditProfile.friday'),
    saturday: t('doctorEditProfile.saturday'),
    sunday: t('doctorEditProfile.sunday'),
  }), [t]);

  const uploadImage = async (file: File, bucket: string, path: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImage(file, 'avatars', profile.id);
      setAvatarUrl(url);
      toast({ title: t('doctorEditProfile.avatarUploaded') });
    } catch (error) {
      toast({ title: t('doctorEditProfile.avatarError'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImage(file, 'avatars', `covers/${doctor.id}`);
      setCoverImage(url);
      toast({ title: t('doctorEditProfile.coverUploaded') });
    } catch (error) {
      toast({ title: t('doctorEditProfile.avatarError'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const addCertification = () => {
    if (newCertification.trim() && !certifications.includes(newCertification.trim())) {
      setCertifications([...certifications, newCertification.trim()]);
      setNewCertification('');
    }
  };

  const removeCertification = (cert: string) => {
    setCertifications(certifications.filter((c) => c !== cert));
  };

  const saveProfile = useMutation({
    onMutate: () => {
      setFormError(null);
    },
    mutationFn: async () => {
      // Build profile update object - only super_admin can change full_name
      const profileUpdate: ProfileUpdate = {
        phone: phone,
        avatar_url: avatarUrl,
      };
      
      // Only include full_name if user is super_admin
      if (isSuperAdmin) {
        profileUpdate.full_name = fullName;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // Build working hours object (only enabled days)
      const wh: Record<string, { start: string; end: string }> = {};
      Object.entries(workingHours).forEach(([day, data]) => {
        if (data.enabled) {
          wh[day] = { start: data.start, end: data.end };
        }
      });

      // Update doctor
      const { error: doctorError } = await supabase
        .from('doctors')
        .update({
          specialty,
          category,
          bio,
          education,
          experience_years: experienceYears,
          price_from: priceFrom,
          cover_url: coverImage,
          video_url: videoUrl,
          certifications,
          working_hours: wh,
        })
        .eq('id', doctor.id);

      if (doctorError) throw doctorError;
    },
    onSuccess: () => {
      setFormError(null);
      toast({ title: t('doctorEditProfile.profileSaved') });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: (error: ProfileMutationError) => {
      setFormError(error.message || t('doctorEditProfile.saveError'));
      toast({ title: t('doctorEditProfile.saveError'), variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto p-4 sm:w-full sm:p-6">
        <DialogHeader>
          <DialogTitle>{t('doctorEditProfile.title')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid h-auto w-full grid-cols-4">
            <TabsTrigger value="basic" className="min-h-11 min-w-11 gap-1 px-2" aria-label={t('doctorEditProfile.tabBasic')}>
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{t('doctorEditProfile.tabBasic')}</span>
            </TabsTrigger>
            <TabsTrigger value="education" className="min-h-11 min-w-11 gap-1 px-2" aria-label={t('doctorEditProfile.tabEducation')}>
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">{t('doctorEditProfile.tabEducation')}</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="min-h-11 min-w-11 gap-1 px-2" aria-label={t('doctorEditProfile.tabSchedule')}>
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">{t('doctorEditProfile.tabSchedule')}</span>
            </TabsTrigger>
            <TabsTrigger value="media" className="min-h-11 min-w-11 gap-1 px-2" aria-label={t('doctorEditProfile.tabMedia')}>
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('doctorEditProfile.tabMedia')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Basic Info */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Avatar */}
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback>{fullName?.charAt(0) || 'D'}</AvatarFallback>
                </Avatar>
                <label
                  htmlFor="edit-doctor-avatar"
                  className="absolute bottom-0 right-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                  aria-label={t('doctorEditProfile.avatarPhoto')}
                >
                  <Camera className="w-4 h-4" />
                  <input
                    id="edit-doctor-avatar"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              <div className="min-w-0">
                <p className="font-medium">{t('doctorEditProfile.avatarPhoto')}</p>
                <p className="text-sm text-muted-foreground">{t('doctorEditProfile.avatarPhotoHint')}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-doctor-full-name" className="flex flex-wrap items-center gap-2">
                  {t('doctorEditProfile.fullNameLabel')}
                  {!isSuperAdmin && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {t('doctorEditProfile.changedByAdmin')}
                    </span>
                  )}
                </Label>
                <Input
                  id="edit-doctor-full-name"
                  value={fullName}
                  onChange={(e) => isSuperAdmin && setFullName(e.target.value)}
                  placeholder={t('doctorEditProfile.fullNamePh')}
                  disabled={!isSuperAdmin}
                  className={`h-11 ${!isSuperAdmin ? "bg-muted cursor-not-allowed" : ""}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-doctor-phone">{t('doctorEditProfile.phone')}</Label>
                <Input
                  id="edit-doctor-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('doctorEditProfile.phonePlaceholder')}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-doctor-specialty">{t('doctorEditProfile.specialty')}</Label>
                <Input
                  id="edit-doctor-specialty"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder={t('doctorEditProfile.specialtyPh')}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-doctor-category">{t('doctorEditProfile.category')}</Label>
                <Input
                  id="edit-doctor-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={t('doctorEditProfile.categoryHigh')}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-doctor-experience">{t('doctorEditProfile.experienceLabel')}</Label>
                <Input
                  id="edit-doctor-experience"
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-doctor-price">{t('doctorEditProfile.priceFromLabel')}</Label>
                <Input
                  id="edit-doctor-price"
                  type="number"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(parseInt(e.target.value) || 0)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-doctor-bio">{t('doctorEditProfile.bioLabel')}</Label>
              <Textarea
                id="edit-doctor-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('doctorEditProfile.bioPh')}
                rows={4}
              />
            </div>
          </TabsContent>

          {/* Education */}
          <TabsContent value="education" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-doctor-education">{t('doctorEditProfile.educationLabel')}</Label>
              <Textarea
                id="edit-doctor-education"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder={t('doctorEditProfile.educationPh')}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-doctor-certification">{t('doctorEditProfile.certsLabel')}</Label>
              <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
                <Input
                  id="edit-doctor-certification"
                  value={newCertification}
                  onChange={(e) => setNewCertification(e.target.value)}
                  placeholder={t('doctorEditProfile.certPlaceholder')}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                  className="h-11 min-w-0"
                />
                <Button
                  type="button"
                  onClick={addCertification}
                  size="icon"
                  className="h-11 w-11 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('doctorEditProfile.certsLabel')}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {certifications.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {certifications.map((cert, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      <Award className="w-3 h-3" />
                      {cert}
                      <button
                        type="button"
                        onClick={() => removeCertification(cert)}
                        className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-md hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`${t('doctorEditProfile.cancel')}: ${cert}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Schedule */}
          <TabsContent value="schedule" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              {t('doctorEditProfile.scheduleHint')}
            </p>
            <div className="space-y-3">
              {Object.entries(daysMap).map(([key, label]) => (
                <div key={key} className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label
                    htmlFor={`edit-doctor-day-${key}`}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2 sm:w-32"
                  >
                    <input
                      id={`edit-doctor-day-${key}`}
                      type="checkbox"
                      checked={workingHours[key]?.enabled || false}
                      onChange={(e) =>
                        setWorkingHours((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], enabled: e.target.checked },
                        }))
                      }
                      className="h-5 w-5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                  {workingHours[key]?.enabled && (
                    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <Label htmlFor={`edit-doctor-${key}-start`} className="sr-only">
                        {label}: {t('doctorEditProfile.scheduleHint')} 1
                      </Label>
                      <Input
                        id={`edit-doctor-${key}-start`}
                        type="time"
                        value={workingHours[key]?.start || '09:00'}
                        onChange={(e) =>
                          setWorkingHours((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], start: e.target.value },
                          }))
                        }
                        className="h-11 min-w-0 w-full"
                      />
                      <span className="text-muted-foreground">—</span>
                      <Label htmlFor={`edit-doctor-${key}-end`} className="sr-only">
                        {label}: {t('doctorEditProfile.scheduleHint')} 2
                      </Label>
                      <Input
                        id={`edit-doctor-${key}-end`}
                        type="time"
                        value={workingHours[key]?.end || '18:00'}
                        onChange={(e) =>
                          setWorkingHours((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], end: e.target.value },
                          }))
                        }
                        className="h-11 min-w-0 w-full"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Media */}
          <TabsContent value="media" className="space-y-4 mt-4">
            {/* Cover Image */}
            <div className="space-y-2">
              <Label id="edit-doctor-cover-label" htmlFor="edit-doctor-cover">{t('doctorEditProfile.coverLabel')}</Label>
              <div className="relative h-32 bg-muted rounded-lg overflow-hidden">
                {coverImage ? (
                  <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <label
                  htmlFor="edit-doctor-cover"
                  className="absolute inset-0 flex cursor-pointer items-center justify-center bg-foreground/70 text-background opacity-100 transition-opacity focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring sm:opacity-0 sm:hover:opacity-100 sm:focus-within:opacity-100"
                >
                  <div className="text-center">
                    <Camera className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">{t('doctorEditProfile.changeCover')}</span>
                  </div>
                  <input
                    id="edit-doctor-cover"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleCoverUpload}
                    disabled={uploading}
                    aria-labelledby="edit-doctor-cover-label"
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('doctorEditProfile.coverSizeHint')}
              </p>
            </div>

            {/* Video URL */}
            <div className="space-y-2">
              <Label htmlFor="edit-doctor-video">{t('doctorEditProfile.videoLabel')}</Label>
              <Input
                id="edit-doctor-video"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="h-11"
                aria-describedby="edit-doctor-video-hint"
              />
              <p id="edit-doctor-video-hint" className="text-xs text-muted-foreground">
                {t('doctorEditProfile.videoHint')}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {formError && (
          <p id="edit-doctor-form-error" className="mt-4 text-sm text-destructive" role="alert">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse justify-end gap-2 mt-6 pt-4 border-t sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          >
            {t('doctorEditProfile.cancel')}
          </Button>
          <Button
            onClick={() => saveProfile.mutate()}
            disabled={saveProfile.isPending}
            className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            aria-describedby={formError ? "edit-doctor-form-error" : undefined}
          >
            {saveProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('doctorEditProfile.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
