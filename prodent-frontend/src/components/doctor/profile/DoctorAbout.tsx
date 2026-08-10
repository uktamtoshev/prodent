import { lazy, Suspense, useState } from 'react';
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
  Heart
} from 'lucide-react';
import { DoctorLocationMap } from './DoctorLocationMap';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DoctorPublicData } from './doctor-profile-types';

const EditBioDialog = lazy(() =>
  import("./InlineEditDialogs").then((module) => ({ default: module.EditBioDialog })),
);
const EditEducationDialog = lazy(() =>
  import("./InlineEditDialogs").then((module) => ({ default: module.EditEducationDialog })),
);
const EditCertificationsDialog = lazy(() =>
  import("./InlineEditDialogs").then((module) => ({ default: module.EditCertificationsDialog })),
);
const EditExperienceDialog = lazy(() =>
  import("./InlineEditDialogs").then((module) => ({ default: module.EditExperienceDialog })),
);
const EditWorkingHoursDialog = lazy(() =>
  import("./InlineEditDialogs").then((module) => ({ default: module.EditWorkingHoursDialog })),
);
const EditContactDialog = lazy(() =>
  import("./InlineEditDialogs").then((module) => ({ default: module.EditContactDialog })),
);
const EditVideoDialog = lazy(() =>
  import("./InlineEditDialogs").then((module) => ({ default: module.EditVideoDialog })),
);
const EditLocationDialog = lazy(() =>
  import("./InlineEditDialogs").then((module) => ({ default: module.EditLocationDialog })),
);

interface DoctorAboutProps {
  doctor: {
    id: string;
    user_id: string;
    bio?: string | null;
    cooperation_type?: string | null;
    clinic_id?: string | null;
    education?: string | null;
    certifications?: string[] | null;
    working_hours?: Record<string, { start: string; end: string }> | null;
    video_url?: string | null;
    experience_years?: number | null;
    specialty?: string | null;
    category?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    profile?: {
      phone?: string | null;
      email?: string | null;
      full_name?: string | null;
    } | null;
    clinic?: {
      name: string;
      address: string;
      city: string;
      phone?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  };
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
  const { t } = useLanguage();
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
    monday: t('doctorAbout.monday'),
    tuesday: t('doctorAbout.tuesday'),
    wednesday: t('doctorAbout.wednesday'),
    thursday: t('doctorAbout.thursday'),
    friday: t('doctorAbout.friday'),
    saturday: t('doctorAbout.saturday'),
    sunday: t('doctorAbout.sunday'),
  };
  const editSectionLabel = (section: string) =>
    `${t('doctorProfileHeader.editProfile')}: ${section}`;
  const addSectionLabel = (section: string) =>
    `${t('doctorAbout.add')}: ${section}`;

  const EditButton = ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) => (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-11 w-11 shrink-0 rounded-full transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <Pencil className="w-4 h-4" />
    </Button>
  );

  const AddButton = ({ onClick, label, ariaLabel }: { onClick: () => void; label: string; ariaLabel: string }) => (
    <Button 
      variant="outline" 
      size="sm" 
      className="min-h-11 gap-2 border-dashed hover:border-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      aria-label={ariaLabel}
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
              <CardTitle className="text-xl">{t('doctorAbout.sectionAbout')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('doctorAbout.specialtyLabel')}</p>
            </div>
          </div>
          {isOwner && (
            <EditButton
              onClick={() => setEditBioOpen(true)}
              ariaLabel={editSectionLabel(t('doctorAbout.sectionAbout'))}
            />
          )}
        </CardHeader>
        <CardContent>
          {doctor.bio ? (
            <p className="whitespace-pre-wrap text-foreground text-base leading-relaxed">{doctor.bio}</p>
          ) : isOwner ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">{t('doctorInlineEdit.bioPlaceholder')}</p>
              <AddButton
                onClick={() => setEditBioOpen(true)}
                label={t('doctorAbout.add')}
                ariaLabel={addSectionLabel(t('doctorAbout.sectionAbout'))}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-base">{t('doctorAbout.noBio')}</p>
          )}
        </CardContent>
      </Card>

      {/* Cooperation Type Badge - only show if doctor has clinic affiliation */}
      {doctor.cooperation_type && doctor.clinic_id && (
        <Card className={`p-4 border-0 ${
          doctor.cooperation_type === 'chair_rental'
            ? 'bg-secondary'
            : 'bg-card'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              doctor.cooperation_type === 'chair_rental'
                ? 'bg-secondary'
                : 'bg-primary/20'
            }`}>
              <Briefcase className={`w-5 h-5 ${
                doctor.cooperation_type === 'chair_rental'
                  ? 'text-status-neutral'
                  : 'text-primary'
              }`} />
            </div>
            <div>
              <Badge variant="secondary" className={`${
                doctor.cooperation_type === 'chair_rental'
                  ? 'bg-secondary text-secondary-foreground border-border'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}>
                {doctor.cooperation_type === 'chair_rental' ? t('doctorAbout.sectionAbout') : t('doctorAbout.sectionAbout')}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {doctor.cooperation_type === 'chair_rental'
                  ? t('doctorAbout.sectionAbout')
                  : t('doctorAbout.sectionAbout')}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Education */}
        <Card className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32  rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base font-bold">{t('doctorAbout.sectionEducation')}</CardTitle>
            </div>
            {isOwner && (
              <EditButton
                onClick={() => setEditEducationOpen(true)}
                ariaLabel={editSectionLabel(t('doctorAbout.sectionEducation'))}
              />
            )}
          </CardHeader>
          <CardContent>
            {doctor.education ? (
              <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{doctor.education}</p>
            ) : isOwner ? (
              <AddButton
                onClick={() => setEditEducationOpen(true)}
                label={t('doctorAbout.add')}
                ariaLabel={addSectionLabel(t('doctorAbout.sectionEducation'))}
              />
            ) : (
              <p className="text-muted-foreground">{t('doctorAbout.noEducation')}</p>
            )}
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32  rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base font-bold">{t('doctorAbout.sectionCertifications')}</CardTitle>
            </div>
            {isOwner && (
              <EditButton
                onClick={() => setEditCertificationsOpen(true)}
                ariaLabel={editSectionLabel(t('doctorAbout.sectionCertifications'))}
              />
            )}
          </CardHeader>
          <CardContent>
            {doctor.certifications && doctor.certifications.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {doctor.certifications.map((cert: string, i: number) => (
                  <Badge 
                    key={i} 
                    variant="secondary" 
                    className="text-sm py-1.5 px-4 bg-primary/10 text-primary border-primary/20"
                  >
                    {cert}
                  </Badge>
                ))}
              </div>
            ) : isOwner ? (
              <AddButton
                onClick={() => setEditCertificationsOpen(true)}
                label={t('doctorAbout.add')}
                ariaLabel={addSectionLabel(t('doctorAbout.sectionCertifications'))}
              />
            ) : (
              <p className="text-muted-foreground">{t('doctorAbout.noCerts')}</p>
            )}
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32  rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base font-bold">{t('doctorAbout.sectionWorkingHours')}</CardTitle>
            </div>
            {isOwner && (
              <EditButton
                onClick={() => setEditWorkingHoursOpen(true)}
                ariaLabel={editSectionLabel(t('doctorAbout.sectionWorkingHours'))}
              />
            )}
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
                        ${isWorkday ? 'bg-status-success/5' : 'bg-muted/30'}`}
                    >
                      <span className={isWorkday ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
                      <span className={`font-medium ${isWorkday ? 'text-status-success' : 'text-muted-foreground'}`}>
                        {hours ? `${hours.start} – ${hours.end}` : t('doctorAbout.closedDay')}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : isOwner ? (
              <AddButton
                onClick={() => setEditWorkingHoursOpen(true)}
                label={t('doctorAbout.add')}
                ariaLabel={addSectionLabel(t('doctorAbout.sectionWorkingHours'))}
              />
            ) : (
              <p className="text-muted-foreground">{t('doctorAbout.noHours')}</p>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32  rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base font-bold">{t('doctorAbout.sectionContacts')}</CardTitle>
            </div>
            {isOwner && (
              <EditButton
                onClick={() => setEditContactOpen(true)}
                ariaLabel={editSectionLabel(t('doctorAbout.sectionContacts'))}
              />
            )}
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
              <p className="text-muted-foreground">{t('doctorAbout.noContacts')}</p>
            )}
            {!doctor.profile?.phone && !doctor.profile?.email && isOwner && (
              <AddButton
                onClick={() => setEditContactOpen(true)}
                label={t('doctorAbout.add')}
                ariaLabel={addSectionLabel(t('doctorAbout.sectionContacts'))}
              />
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
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base font-bold">{t('doctorAbout.sectionVideo')}</CardTitle>
            </div>
            {isOwner && (
              <EditButton
                onClick={() => setEditVideoOpen(true)}
                ariaLabel={editSectionLabel(t('doctorAbout.sectionVideo'))}
              />
            )}
          </CardHeader>
          <CardContent>
            {doctor.video_url ? (
              <div className="aspect-video rounded-xl overflow-hidden bg-muted shadow-inner">
                {isYouTubeUrl(doctor.video_url) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(doctor.video_url)}`}
                    title={t('doctorAbout.sectionVideo')}
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
                <p className="text-muted-foreground mb-4">{t('doctorAbout.noVideo')}</p>
                <AddButton
                  onClick={() => setEditVideoOpen(true)}
                  label={t('doctorAbout.add')}
                  ariaLabel={addSectionLabel(t('doctorAbout.sectionVideo'))}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Editors are loaded only after the owner opens one. */}
      <Suspense fallback={null}>
        {editBioOpen && (
          <EditBioDialog
            open
            onOpenChange={setEditBioOpen}
            doctorId={doctor.id}
            currentBio={doctor.bio || ''}
          />
        )}
        {editEducationOpen && (
          <EditEducationDialog
            open
            onOpenChange={setEditEducationOpen}
            doctorId={doctor.id}
            currentEducation={doctor.education || ''}
          />
        )}
        {editCertificationsOpen && (
          <EditCertificationsDialog
            open
            onOpenChange={setEditCertificationsOpen}
            doctorId={doctor.id}
            currentCertifications={doctor.certifications || []}
          />
        )}
        {editExperienceOpen && (
          <EditExperienceDialog
            open
            onOpenChange={setEditExperienceOpen}
            doctorId={doctor.id}
            currentData={{
              experience_years: doctor.experience_years,
              specialty: doctor.specialty,
              category: doctor.category,
            }}
          />
        )}
        {editWorkingHoursOpen && (
          <EditWorkingHoursDialog
            open
            onOpenChange={setEditWorkingHoursOpen}
            doctorId={doctor.id}
            currentHours={workingHours}
          />
        )}
        {editContactOpen && (
          <EditContactDialog
            open
            onOpenChange={setEditContactOpen}
            profileId={doctor.user_id}
            currentData={{
              phone: doctor.profile?.phone || '',
              email: doctor.profile?.email || '',
            }}
          />
        )}
        {editVideoOpen && (
          <EditVideoDialog
            open
            onOpenChange={setEditVideoOpen}
            doctorId={doctor.id}
            currentVideoUrl={doctor.video_url || ''}
          />
        )}
        {editLocationOpen && (
          <EditLocationDialog
            open
            onOpenChange={setEditLocationOpen}
            doctorId={doctor.id}
            currentData={{
              address: doctor.address || null,
              latitude: doctor.latitude || null,
              longitude: doctor.longitude || null,
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
