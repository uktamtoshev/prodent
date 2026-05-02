import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/contexts/AdminContext';
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
  doctor: any;
  profile: any;
}

export function EditDoctorProfileDialog({
  open,
  onOpenChange,
  doctor,
  profile,
}: EditDoctorProfileDialogProps) {
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
      setCoverImage(doctor.cover_image || '');
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

  const daysMap: Record<string, string> = {
    monday: 'Понедельник',
    tuesday: 'Вторник',
    wednesday: 'Среда',
    thursday: 'Четверг',
    friday: 'Пятница',
    saturday: 'Суббота',
    sunday: 'Воскресенье',
  };

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
      toast({ title: 'Аватар загружен' });
    } catch (error) {
      toast({ title: 'Ошибка загрузки', variant: 'destructive' });
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
      toast({ title: 'Обложка загружена' });
    } catch (error) {
      toast({ title: 'Ошибка загрузки', variant: 'destructive' });
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
    mutationFn: async () => {
      // Build profile update object - only super_admin can change full_name
      const profileUpdate: Record<string, any> = {
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
          cover_image: coverImage,
          video_url: videoUrl,
          certifications,
          working_hours: wh,
        })
        .eq('id', doctor.id);

      if (doctorError) throw doctorError;
    },
    onSuccess: () => {
      toast({ title: 'Профиль сохранён' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактирование профиля</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic" className="gap-1">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Основное</span>
            </TabsTrigger>
            <TabsTrigger value="education" className="gap-1">
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Образование</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">График</span>
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Медиа</span>
            </TabsTrigger>
          </TabsList>

          {/* Basic Info */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback>{fullName?.charAt(0) || 'D'}</AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              <div>
                <p className="font-medium">Фото профиля</p>
                <p className="text-sm text-muted-foreground">JPG, PNG до 5MB</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  ФИО
                  {!isSuperAdmin && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Изменяется администратором
                    </span>
                  )}
                </Label>
                <Input
                  value={fullName}
                  onChange={(e) => isSuperAdmin && setFullName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  disabled={!isSuperAdmin}
                  className={!isSuperAdmin ? "bg-muted cursor-not-allowed" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Специализация</Label>
                <Input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Стоматолог-терапевт"
                />
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Высшая категория"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Стаж (лет)</Label>
                <Input
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Цена от (сум)</Label>
                <Input
                  type="number"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>О себе</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Расскажите о себе, своём опыте и подходе к лечению..."
                rows={4}
              />
            </div>
          </TabsContent>

          {/* Education */}
          <TabsContent value="education" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Образование</Label>
              <Textarea
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="Укажите ваше образование, ВУЗы, годы обучения..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Сертификаты и курсы</Label>
              <div className="flex gap-2">
                <Input
                  value={newCertification}
                  onChange={(e) => setNewCertification(e.target.value)}
                  placeholder="Название сертификата"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                />
                <Button type="button" onClick={addCertification} size="icon">
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
                        className="ml-1 hover:text-destructive"
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
              Укажите ваш рабочий график
            </p>
            <div className="space-y-3">
              {Object.entries(daysMap).map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-32">
                    <input
                      type="checkbox"
                      checked={workingHours[key]?.enabled || false}
                      onChange={(e) =>
                        setWorkingHours((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], enabled: e.target.checked },
                        }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                  {workingHours[key]?.enabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={workingHours[key]?.start || '09:00'}
                        onChange={(e) =>
                          setWorkingHours((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], start: e.target.value },
                          }))
                        }
                        className="w-28"
                      />
                      <span className="text-muted-foreground">—</span>
                      <Input
                        type="time"
                        value={workingHours[key]?.end || '18:00'}
                        onChange={(e) =>
                          setWorkingHours((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], end: e.target.value },
                          }))
                        }
                        className="w-28"
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
              <Label>Обложка профиля</Label>
              <div className="relative h-32 bg-muted rounded-lg overflow-hidden">
                {coverImage ? (
                  <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="text-white text-center">
                    <Camera className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Изменить обложку</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Рекомендуемый размер: 1200x400 пикселей
              </p>
            </div>

            {/* Video URL */}
            <div className="space-y-2">
              <Label>Видео-презентация (URL)</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
              <p className="text-xs text-muted-foreground">
                Ссылка на YouTube или прямая ссылка на видео
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
