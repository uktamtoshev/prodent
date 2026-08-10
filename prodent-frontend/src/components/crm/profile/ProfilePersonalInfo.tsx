import { useState, useRef, useMemo } from 'react';
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
import { useLanguage } from '@/contexts/LanguageContext';
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

type EducationItem = {
  year?: string | number | null;
  degree?: string | null;
  title?: string | null;
};

type ProfileInfoDoctor = {
  id: string;
  specialty?: string | null;
  experience_years?: number | null;
  education?: string | EducationItem[] | null;
  bio?: string | null;
  address?: string | null;
  languages?: string | string[] | null;
};

type ProfileInfoProfile = {
  id: string;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type MutationError = { message?: string } | Error | unknown;

const errorMessage = (error: MutationError) =>
  error instanceof Error ? error.message : undefined;

/**
 * В базе `doctors.education` и `doctors.languages` — текстовые колонки, куда
 * пишется JSON. Приходить оттуда может что угодно: массив, JSON-строка или
 * просто текст, который когда-то ввели руками. Разбираем все три случая, иначе
 * в поле формы попадает сырой JSON, а публичный профиль перестаёт его читать.
 */
const parseJsonArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** JSON-массив образования → «2014 · Врач-стоматолог · ТГСИ; 2016 · …» */
const educationToText = (raw: unknown): string => {
  const items = parseJsonArray(raw) as EducationItem[];
  if (items.length > 0) {
    return items
      .map((e) => [e?.year, e?.degree, e?.title ?? (e as { institution?: string })?.institution]
        .filter(Boolean)
        .join(' · '))
      .filter(Boolean)
      .join('; ');
  }
  return typeof raw === 'string' && !raw.trim().startsWith('[') ? raw : '';
};

/** Обратно в JSON-массив, чтобы публичный профиль продолжал его разбирать. */
const serializeEducation = (text: string): string => {
  const items = text
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split('·').map((p) => p.trim()).filter(Boolean);
      const year = parts.find((p) => /^\d{4}$/.test(p));
      const rest = parts.filter((p) => p !== year);
      return {
        year: year ? Number(year) : undefined,
        degree: rest[0] ?? undefined,
        institution: rest[1] ?? rest[0] ?? undefined,
      };
    });
  return JSON.stringify(items);
};

interface ProfilePersonalInfoProps {
  doctor: ProfileInfoDoctor | null;
  profile: ProfileInfoProfile;
}

export function ProfilePersonalInfo({ doctor, profile }: ProfilePersonalInfoProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const AVAILABLE_LANGUAGES = useMemo(() => [
    t('crmProfilePersonal.langRussian'),
    t('crmProfilePersonal.langUzbek'),
    t('crmProfilePersonal.langEnglish'),
    t('crmProfilePersonal.langTajik'),
    t('crmProfilePersonal.langKazakh'),
    t('crmProfilePersonal.langKyrgyz'),
    t('crmProfilePersonal.langKorean'),
    t('crmProfilePersonal.langTurkish'),
    t('crmProfilePersonal.langArabic'),
  ], [t]);
  
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
    education: educationToText(doctor?.education),
    bio: doctor?.bio || '',
    address: doctor?.address || '',
    languages: parseJsonArray(doctor?.languages) as string[],
  });

  const [newLanguage, setNewLanguage] = useState('');

  const updateProfile = useMutation({
    mutationFn: async () => {
      // Имя, фамилию и телефон отсюда не меняем: имя и фамилия приходят из
      // проверенных документов, телефон — это логин, он меняется отдельной
      // процедурой с подтверждением по SMS.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          middle_name: formData.middle_name,
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
          education: serializeEducation(formData.education),
          bio: formData.bio,
          address: formData.address,
          // Колонка текстовая и хранит JSON-массив: универсальный прокси
          // данных приводит к jsonb только колонки из своего списка, а
          // добавление в него требует пересборки бэкенда.
          languages: JSON.stringify(formData.languages ?? []),
        })
        .eq('id', doctor.id);

      if (doctorError) throw doctorError;
    },
    onSuccess: () => {
      toast({ title: t('crmProfilePersonal.profileUpdated') });
      queryClient.invalidateQueries({ queryKey: ['crm-doctor-profile'] });
      setIsEditing(false);
    },
    onError: (error: MutationError) => {
      toast({
        title: t('crmProfilePersonal.errorTitle'),
        description: errorMessage(error),
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

      toast({ title: t('crmProfilePersonal.photoUpdated') });
      queryClient.invalidateQueries({ queryKey: ['crm-doctor-profile'] });
    } catch (error: MutationError) {
      toast({
        title: t('crmProfilePersonal.errorTitle'),
        description: errorMessage(error),
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
        <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
          <User className="w-5 h-5 text-primary" />
          {t('crmProfilePersonal.personalInfoTitle')}
        </CardTitle>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            {t('crmProfilePersonal.editBtn')}
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
                  education: educationToText(doctor?.education),
                  bio: doctor?.bio || '',
                  address: doctor?.address || '',
                  languages: parseJsonArray(doctor?.languages) as string[],
                });
              }}
            >
              {t('crmProfilePersonal.cancelBtn')}
            </Button>
            <Button
              size="sm"
              onClick={() => updateProfile.mutate()}
              disabled={updateProfile.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {updateProfile.isPending ? t('crmProfilePersonal.saving') : t('crmProfilePersonal.save')}
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
            <h3 className="text-base font-bold text-foreground">
              {profile?.full_name || t('crmProfilePersonal.yourName')}
            </h3>
            <p className="text-muted-foreground">{doctor?.specialty}</p>
            {doctor?.verified && (
              <Badge variant="secondary" className="mt-2 bg-primary/10 text-primary">
                {t('crmProfilePersonal.verified')}
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
              {t('crmProfilePersonal.lastNameLabel')}
            </Label>
            {/* Фамилия — из подтверждённых документов, меняется только через поддержку */}
            <p className="text-foreground py-2">{profile?.last_name || '—'}</p>
          </div>

          {/* First Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              {t('crmProfilePersonal.firstNameLabel')}
            </Label>
            {/* Имя — из подтверждённых документов, меняется только через поддержку */}
            <p className="text-foreground py-2">{profile?.first_name || '—'}</p>
          </div>

          {/* Middle Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              {t('crmProfilePersonal.middleNameLabel')}
            </Label>
            {isEditing ? (
              <Input
                value={formData.middle_name}
                onChange={(e) => setFormData(prev => ({ ...prev, middle_name: e.target.value }))}
                placeholder={t('crmProfilePersonal.middleNamePh')}
              />
            ) : (
              <p className="text-foreground py-2">{profile?.middle_name || '—'}</p>
            )}
          </div>

          {/* Specialty */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              {t('crmProfilePersonal.specialtyLabel')}
            </Label>
            {isEditing ? (
              <Input
                value={formData.specialty}
                onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                placeholder={t('crmProfilePersonal.specialtyPh')}
              />
            ) : (
              <p className="text-foreground py-2">{doctor?.specialty || '—'}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              {t('crmProfilePersonal.phoneLabel')}
            </Label>
            {/* Телефон — логин в системе, меняется отдельной процедурой с проверкой по SMS */}
            <p className="text-foreground py-2">{profile?.phone || '—'}</p>
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
              {t('crmProfilePersonal.experienceLabel')}
            </Label>
            {isEditing ? (
              <Input
                type="number"
                min={0}
                value={formData.experience_years}
                onChange={(e) => setFormData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
              />
            ) : (
              <p className="text-foreground py-2">{doctor?.experience_years || 0} {t('crmProfilePersonal.yearsSuffix')}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {t('crmProfilePersonal.addressLabel')}
            </Label>
            {isEditing ? (
              <Input
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder={t('crmProfilePersonal.addressPh')}
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
            {t('crmProfilePersonal.educationLabel')}
          </Label>
          {isEditing ? (
            <Input
              value={formData.education}
              onChange={(e) => setFormData(prev => ({ ...prev, education: e.target.value }))}
              placeholder={t('crmProfilePersonal.educationPh')}
            />
          ) : Array.isArray(doctor?.education) ? (
            <ul className="space-y-1.5 py-2">
              {(doctor!.education as Array<{ year?: string | number; title?: string; degree?: string }>).map((e, i) => (
                <li key={i} className="text-foreground text-sm">
                  {[e.year, e.degree, e.title].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-foreground py-2">
              {typeof doctor?.education === 'string' ? doctor.education : '—'}
            </p>
          )}
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-muted-foreground" />
            {t('crmProfilePersonal.languagesLabel')}
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
              {parseJsonArray(doctor?.languages).length > 0 ? (
                (parseJsonArray(doctor?.languages) as string[]).map((lang: string) => (
                  <Badge key={lang} variant="secondary">{lang}</Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{t('crmProfilePersonal.notSpecified')}</span>
              )}
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label>{t('crmProfilePersonal.aboutLabel')}</Label>
          {isEditing ? (
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder={t('crmProfilePersonal.aboutPh')}
              className="min-h-[100px]"
            />
          ) : (
            <p className="text-foreground py-2 whitespace-pre-wrap">
              {doctor?.bio || t('crmProfilePersonal.noBio')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
