import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, 
  Award, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  Building2,
  Calendar,
  Briefcase,
  Pencil,
  Plus,
  Video,
  Globe,
  Heart,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import {
  EditBioDialog,
  EditEducationDialog,
  EditCertificationsDialog,
  EditExperienceDialog,
  EditWorkingHoursDialog,
  EditContactDialog,
  EditVideoDialog,
  EditLocationDialog,
} from './InlineEditDialogs';
import { DoctorLocationMap } from './DoctorLocationMap';

interface DoctorAboutProps {
  doctor: any;
  isOwner?: boolean;
}

// Helper function to extract YouTube video ID
const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const isYouTubeUrl = (url: string): boolean => {
  return url?.includes('youtube.com') || url?.includes('youtu.be');
};

export function DoctorAbout({ doctor, isOwner = false }: DoctorAboutProps) {
  const [editBioOpen, setEditBioOpen] = useState(false);
  const [editEducationOpen, setEditEducationOpen] = useState(false);
  const [editCertificationsOpen, setEditCertificationsOpen] = useState(false);
  const [editExperienceOpen, setEditExperienceOpen] = useState(false);
  const [editWorkingHoursOpen, setEditWorkingHoursOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editVideoOpen, setEditVideoOpen] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);

  const workingHours = doctor.working_hours as Record<string, { start: string; end: string }> | null;

  const daysMap: Record<string, string> = {
    monday: 'Понедельник',
    tuesday: 'Вторник',
    wednesday: 'Среда',
    thursday: 'Четверг',
    friday: 'Пятница',
    saturday: 'Суббота',
    sunday: 'Воскресенье',
  };

  const EditButton = ({ onClick }: { onClick: () => void }) => (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary transition-colors" 
      onClick={onClick}
    >
      <Pencil className="w-4 h-4" />
    </Button>
  );

  const AddButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <Button 
      variant="outline" 
      size="sm" 
      className="gap-2 border-dashed hover:border-primary hover:bg-primary/5" 
      onClick={onClick}
    >
      <Plus className="w-4 h-4" />
      {label}
    </Button>
  );

  return (
    <div className="space-y-8">
      {/* Hero Bio Section */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">О враче</CardTitle>
              <p className="text-sm text-muted-foreground">Профессиональная информация</p>
            </div>
          </div>
          {isOwner && <EditButton onClick={() => setEditBioOpen(true)} />}
        </CardHeader>
        <CardContent>
          {doctor.bio ? (
            <p className="whitespace-pre-wrap text-foreground text-base leading-relaxed">{doctor.bio}</p>
          ) : isOwner ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Расскажите о себе, своём опыте и подходе к лечению</p>
              <AddButton onClick={() => setEditBioOpen(true)} label="Добавить описание" />
            </div>
          ) : (
            <p className="text-muted-foreground text-base">Информация не указана</p>
          )}
        </CardContent>
      </Card>

      {/* Cooperation Type Badge - only show if doctor has clinic affiliation */}
      {doctor.cooperation_type && doctor.clinic_id && (
        <Card className={`p-4 border-0 ${
          doctor.cooperation_type === 'chair_rental' 
            ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent' 
            : 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              doctor.cooperation_type === 'chair_rental' 
                ? 'bg-amber-500/20' 
                : 'bg-primary/20'
            }`}>
              <Briefcase className={`w-5 h-5 ${
                doctor.cooperation_type === 'chair_rental' 
                  ? 'text-amber-500' 
                  : 'text-primary'
              }`} />
            </div>
            <div>
              <Badge variant="secondary" className={`${
                doctor.cooperation_type === 'chair_rental'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}>
                {doctor.cooperation_type === 'chair_rental' ? 'Арендатор кресла' : 'Штатный врач'}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {doctor.cooperation_type === 'chair_rental' 
                  ? 'Ведёт собственных пациентов' 
                  : 'Принимает пациентов клиники'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-center p-6 border-0 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
            <Briefcase className="w-7 h-7 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{doctor.experience_years}</p>
          <p className="text-sm text-muted-foreground">лет опыта</p>
        </Card>
        
        <Card className="text-center p-6 border-0 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
            <Award className="w-7 h-7 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">{doctor.certifications?.length || 0}</p>
          <p className="text-sm text-muted-foreground">сертификатов</p>
        </Card>
        
        <Card className="text-center p-6 border-0 bg-gradient-to-br from-green-500/10 to-green-500/5">
          <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">{doctor.reviews_count || 0}</p>
          <p className="text-sm text-muted-foreground">отзывов</p>
        </Card>
        
        <Card className="text-center p-6 border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">{doctor.rating || '—'}</p>
          <p className="text-sm text-muted-foreground">рейтинг</p>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Education */}
        <Card className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-blue-500" />
              </div>
              <CardTitle className="text-lg">Образование</CardTitle>
            </div>
            {isOwner && <EditButton onClick={() => setEditEducationOpen(true)} />}
          </CardHeader>
          <CardContent>
            {doctor.education ? (
              <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{doctor.education}</p>
            ) : isOwner ? (
              <AddButton onClick={() => setEditEducationOpen(true)} label="Добавить образование" />
            ) : (
              <p className="text-muted-foreground">Информация не указана</p>
            )}
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <CardTitle className="text-lg">Сертификаты</CardTitle>
            </div>
            {isOwner && <EditButton onClick={() => setEditCertificationsOpen(true)} />}
          </CardHeader>
          <CardContent>
            {doctor.certifications && doctor.certifications.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {doctor.certifications.map((cert: string, i: number) => (
                  <Badge 
                    key={i} 
                    variant="secondary" 
                    className="text-sm py-1.5 px-4 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                  >
                    {cert}
                  </Badge>
                ))}
              </div>
            ) : isOwner ? (
              <AddButton onClick={() => setEditCertificationsOpen(true)} label="Добавить сертификаты" />
            ) : (
              <p className="text-muted-foreground">Сертификаты не указаны</p>
            )}
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-500/5 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-500" />
              </div>
              <CardTitle className="text-lg">График работы</CardTitle>
            </div>
            {isOwner && <EditButton onClick={() => setEditWorkingHoursOpen(true)} />}
          </CardHeader>
          <CardContent>
            {workingHours && Object.keys(workingHours).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(daysMap).map(([key, label]) => {
                  const hours = workingHours[key];
                  const isWorkday = !!hours;
                  return (
                    <div 
                      key={key} 
                      className={`flex justify-between items-center py-2 px-3 rounded-lg transition-colors
                        ${isWorkday ? 'bg-green-500/5' : 'bg-muted/30'}`}
                    >
                      <span className={isWorkday ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
                      <span className={`font-medium ${isWorkday ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        {hours ? `${hours.start} – ${hours.end}` : 'Выходной'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : isOwner ? (
              <AddButton onClick={() => setEditWorkingHoursOpen(true)} label="Настроить график" />
            ) : (
              <p className="text-muted-foreground">График не указан</p>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-purple-500" />
              </div>
              <CardTitle className="text-lg">Контакты</CardTitle>
            </div>
            {isOwner && <EditButton onClick={() => setEditContactOpen(true)} />}
          </CardHeader>
          <CardContent className="space-y-3">
            {doctor.profile?.phone && (
              <a 
                href={`tel:${doctor.profile.phone}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-primary/10 transition-colors group/link"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium group-hover/link:text-primary transition-colors">
                  {doctor.profile.phone}
                </span>
              </a>
            )}
            {doctor.profile?.email && (
              <a 
                href={`mailto:${doctor.profile.email}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-primary/10 transition-colors group/link"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium group-hover/link:text-primary transition-colors">
                  {doctor.profile.email}
                </span>
              </a>
            )}
            {!doctor.profile?.phone && !doctor.profile?.email && !isOwner && (
              <p className="text-muted-foreground">Контакты не указаны</p>
            )}
            {!doctor.profile?.phone && !doctor.profile?.email && isOwner && (
              <AddButton onClick={() => setEditContactOpen(true)} label="Добавить контакты" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clinic Info - Full Width */}
      {doctor.clinic && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{doctor.clinic.name}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <MapPin className="w-4 h-4" />
                  {doctor.clinic.city}, {doctor.clinic.address}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid md:grid-cols-2">
              <div className="p-6 space-y-4">
                {doctor.clinic.phone && (
                  <a 
                    href={`tel:${doctor.clinic.phone}`}
                    className="flex items-center gap-3 text-foreground hover:text-primary transition-colors"
                  >
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    {doctor.clinic.phone}
                  </a>
                )}
              </div>
              <div className="h-64 md:h-auto">
                <DoctorLocationMap 
                  clinic={doctor.clinic} 
                  doctor={doctor} 
                  isOwner={isOwner}
                  onEdit={() => setEditLocationOpen(true)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Presentation */}
      {(doctor.video_url || isOwner) && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-red-500" />
              </div>
              <CardTitle className="text-lg">Видео-презентация</CardTitle>
            </div>
            {isOwner && <EditButton onClick={() => setEditVideoOpen(true)} />}
          </CardHeader>
          <CardContent>
            {doctor.video_url ? (
              <div className="aspect-video rounded-xl overflow-hidden bg-muted shadow-inner">
                {isYouTubeUrl(doctor.video_url) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(doctor.video_url)}`}
                    title="Видео-презентация врача"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <video
                    src={doctor.video_url}
                    controls
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ) : isOwner ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground mb-4">Добавьте видео-презентацию для привлечения пациентов</p>
                <AddButton onClick={() => setEditVideoOpen(true)} label="Добавить видео" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialogs */}
      <EditBioDialog
        open={editBioOpen}
        onOpenChange={setEditBioOpen}
        doctorId={doctor.id}
        currentBio={doctor.bio || ''}
      />
      <EditEducationDialog
        open={editEducationOpen}
        onOpenChange={setEditEducationOpen}
        doctorId={doctor.id}
        currentEducation={doctor.education || ''}
      />
      <EditCertificationsDialog
        open={editCertificationsOpen}
        onOpenChange={setEditCertificationsOpen}
        doctorId={doctor.id}
        currentCertifications={doctor.certifications || []}
      />
      <EditExperienceDialog
        open={editExperienceOpen}
        onOpenChange={setEditExperienceOpen}
        doctorId={doctor.id}
        currentData={{
          experience_years: doctor.experience_years,
          specialty: doctor.specialty,
          category: doctor.category,
        }}
      />
      <EditWorkingHoursDialog
        open={editWorkingHoursOpen}
        onOpenChange={setEditWorkingHoursOpen}
        doctorId={doctor.id}
        currentHours={workingHours}
      />
      <EditContactDialog
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        profileId={doctor.user_id}
        currentData={{
          phone: doctor.profile?.phone || '',
          email: doctor.profile?.email || '',
        }}
      />
      <EditVideoDialog
        open={editVideoOpen}
        onOpenChange={setEditVideoOpen}
        doctorId={doctor.id}
        currentVideoUrl={doctor.video_url || ''}
      />
      <EditLocationDialog
        open={editLocationOpen}
        onOpenChange={setEditLocationOpen}
        doctorId={doctor.id}
        currentData={{
          address: doctor.address || null,
          latitude: doctor.latitude || null,
          longitude: doctor.longitude || null,
        }}
      />
    </div>
  );
}
