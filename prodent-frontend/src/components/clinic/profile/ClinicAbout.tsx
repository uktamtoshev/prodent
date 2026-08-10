import { lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Phone, Mail, Globe, Building2, Navigation, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ClinicProfileData } from './types';

const ClinicAboutMap = lazy(() =>
  import('./ClinicAboutMap').then((module) => ({ default: module.ClinicAboutMap })),
);

interface ClinicAboutProps {
  clinic: ClinicProfileData;
}

export function ClinicAbout({ clinic }: ClinicAboutProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            {t('clinicProfile.about')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clinic.description ? (
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{clinic.description}</p>
          ) : (
            <p className="text-muted-foreground italic">{t('clinicProfile.descriptionEmpty')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            {t('clinicProfile.contactsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{t('clinicProfile.address')}</p>
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
                <p className="font-medium text-foreground">{t('clinicProfile.phone')}</p>
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
                <p className="font-medium text-foreground">{t('clinicProfile.website')}</p>
                <p className="text-primary group-hover:underline">{clinic.website}</p>
              </div>
            </a>
          )}
        </CardContent>
      </Card>

      {clinic.latitude && clinic.longitude && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Navigation className="w-5 h-5 text-primary" />
              </div>
              {t('clinicProfile.location')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Suspense fallback={<div className="h-80 w-full bg-muted animate-pulse" aria-label="Загрузка карты" />}>
              <ClinicAboutMap
                name={clinic.name}
                address={clinic.address}
                latitude={clinic.latitude}
                longitude={clinic.longitude}
              />
            </Suspense>
          </CardContent>
        </Card>
      )}

      {clinic.images && clinic.images.length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              {t('clinicProfile.gallery')}
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
