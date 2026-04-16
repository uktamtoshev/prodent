import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  User, 
  Camera, 
  Save, 
  Phone, 
  Mail, 
  MapPin,
  Briefcase,
  GraduationCap,
  Languages,
  X,
  Plus
} from 'lucide-react';

interface ProfilePersonalInfoProps {
  doctor: any;
  profile: any;
}

const AVAILABLE_LANGUAGES = [
  'Русский',
  'Узбекский', 
  'Английский',
  'Таджикский',
  'Казахский',
  'Кыргызский',
  'Корейский',
  'Турецкий',
  'Арабский',
];

export function ProfilePersonalInfo({ doctor, profile }: ProfilePersonalInfoProps) {
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    last_name: profile?.last_name || '',
    first_name: profile?.first_name || '',
    middle_name: profile?.middle_name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    specialty: doctor?.specialty || '',
    experience_years: doctor?.experience_years || 0,
    education: doctor?.education || '',
    bio: doctor?.bio || '',
    address: doctor?.address || '',
    languages: doctor?.languages || [],
  });

  const [newLanguage, setNewLanguage] = useState('');

  const updateProfile = useMutation({
    mutationFn: async () => {
      // Update profile table (use separate name fields - trigger generates full_name)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          last_name: formData.last_name,
          first_name: formData.first_name,
          middle_name: formData.middle_name,
          phone: formData.phone,
          email: formData.email,
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // Update doctors table
      const { error: doctorError } = await supabase
        .from('doctors')
        .update({
          specialty: formData.specialty,
          experience_years: formData.experience_years,
          education: formData.education,
          bio: formData.bio,
          address: formData.address,
          languages: formData.languages,
        })
        .eq('id', doctor.id);

      if (doctorError) throw doctorError;
    },
    onSuccess: () => {
      toast({ title: 'Профиль обновлён' });
      queryClient.invalidateQueries({ queryKey: ['crm-doctor-profile'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Ошибка', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl.publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      toast({ title: 'Фото обновлено' });
      queryClient.invalidateQueries({ queryKey: ['crm-doctor-profile'] });
    } catch (error: any) {
      toast({ 
        title: 'Ошибка', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const addLanguage = (lang: string) => {
    if (lang && !formData.languages.includes(lang)) {
      setFormData(prev => ({
        ...prev,
        languages: [...prev.languages, lang]
      }));
    }
    setNewLanguage('');
  };

  const removeLanguage = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter((l: string) => l !== lang)
    }));
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-foreground flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Личная информация
        </CardTitle>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Редактировать
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  last_name: profile?.last_name || '',
                  first_name: profile?.first_name || '',
                  middle_name: profile?.middle_name || '',
                  phone: profile?.phone || '',
                  email: profile?.email || '',
                  specialty: doctor?.specialty || '',
                  experience_years: doctor?.experience_years || 0,
                  education: doctor?.education || '',
                  bio: doctor?.bio || '',
                  address: doctor?.address || '',
                  languages: doctor?.languages || [],
                });
              }}
            >
              Отмена
            </Button>
            <Button 
              size="sm" 
              onClick={() => updateProfile.mutate()}
              disabled={updateProfile.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {updateProfile.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-primary/20">
              <AvatarImage src={profile?.avatar_url} className="object-cover" />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {profile?.full_name?.charAt(0) || 'D'}
              </AvatarFallback>
            </Avatar>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute -bottom-1 -right-1 rounded-full w-8 h-8 shadow-md"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {profile?.full_name || 'Ваше имя'}
            </h3>
            <p className="text-muted-foreground">{doctor?.specialty}</p>
            {doctor?.verified && (
              <Badge variant="secondary" className="mt-2 bg-primary/10 text-primary">
                Верифицирован
              </Badge>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Last Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Фамилия
            </Label>
            {isEditing ? (
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Иванов"
              />
            ) : (
              <p className="text-foreground py-2">{profile?.last_name || '—'}</p>
            )}
          </div>

          {/* First Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Имя
            </Label>
            {isEditing ? (
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="Алексей"
              />
            ) : (
              <p className="text-foreground py-2">{profile?.first_name || '—'}</p>
            )}
          </div>

          {/* Middle Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Отчество
            </Label>
            {isEditing ? (
              <Input
                value={formData.middle_name}
                onChange={(e) => setFormData(prev => ({ ...prev, middle_name: e.target.value }))}
                placeholder="Петрович"
              />
            ) : (
              <p className="text-foreground py-2">{profile?.middle_name || '—'}</p>
            )}
          </div>

          {/* Specialty */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              Специализация
            </Label>
            {isEditing ? (
              <Input
                value={formData.specialty}
                onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                placeholder="Стоматолог-терапевт"
              />
            ) : (
              <p className="text-foreground py-2">{doctor?.specialty || '—'}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Телефон
            </Label>
            {isEditing ? (
              <Input
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+998 90 123 45 67"
              />
            ) : (
              <p className="text-foreground py-2">{profile?.phone || '—'}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </Label>
            {isEditing ? (
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="doctor@example.com"
              />
            ) : (
              <p className="text-foreground py-2">{profile?.email || '—'}</p>
            )}
          </div>

          {/* Experience */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              Опыт работы (лет)
            </Label>
            {isEditing ? (
              <Input
                type="number"
                min={0}
                value={formData.experience_years}
                onChange={(e) => setFormData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
              />
            ) : (
              <p className="text-foreground py-2">{doctor?.experience_years || 0} лет</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Адрес приёма
            </Label>
            {isEditing ? (
              <Input
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="г. Ташкент, ул. ..."
              />
            ) : (
              <p className="text-foreground py-2">{doctor?.address || '—'}</p>
            )}
          </div>
        </div>

        {/* Education */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
            Образование
          </Label>
          {isEditing ? (
            <Input
              value={formData.education}
              onChange={(e) => setFormData(prev => ({ ...prev, education: e.target.value }))}
              placeholder="Ташкентский медицинский институт, 2015"
            />
          ) : (
            <p className="text-foreground py-2">{doctor?.education || '—'}</p>
          )}
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-muted-foreground" />
            Языки
          </Label>
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {formData.languages.map((lang: string) => (
                  <Badge key={lang} variant="secondary" className="gap-1 pr-1">
                    {lang}
                    <button
                      type="button"
                      onClick={() => removeLanguage(lang)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {AVAILABLE_LANGUAGES.filter(l => !formData.languages.includes(l)).map(lang => (
                  <Button
                    key={lang}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addLanguage(lang)}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {lang}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 py-2">
              {doctor?.languages?.length > 0 ? (
                doctor.languages.map((lang: string) => (
                  <Badge key={lang} variant="secondary">{lang}</Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Не указаны</span>
              )}
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label>О себе</Label>
          {isEditing ? (
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Расскажите о себе, своём подходе к лечению..."
              className="min-h-[100px]"
            />
          ) : (
            <p className="text-foreground py-2 whitespace-pre-wrap">
              {doctor?.bio || 'Описание не добавлено'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
