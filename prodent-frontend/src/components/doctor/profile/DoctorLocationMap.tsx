import { lazy, Suspense, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation, ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { a11yLabel } from "@/lib/a11y-labels";

const DoctorLocationLeafletMap = lazy(() =>
  import('./DoctorLocationLeafletMap').then((module) => ({ default: module.DoctorLocationLeafletMap })),
);

interface DoctorLocationMapProps {
  clinic: {
    name: string;
    address: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  doctor?: {
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    profile?: {
      full_name?: string | null;
    } | null;
  } | null;
  isOwner?: boolean;
  onEdit?: () => void;
}

export function DoctorLocationMap({ clinic, doctor, isOwner = false, onEdit }: DoctorLocationMapProps) {
  const { t } = useLanguage();

  const locationData = useMemo(() => ({
    latitude: doctor?.latitude ?? clinic?.latitude,
    longitude: doctor?.longitude ?? clinic?.longitude,
    address: doctor?.address ?? clinic?.address ?? '',
    name: doctor?.profile?.full_name ?? clinic?.name ?? t('doctorLocationMap.doctorFallback'),
    city: clinic?.city ?? ''
  }), [clinic?.address, clinic?.city, clinic?.latitude, clinic?.longitude, clinic?.name, doctor?.address, doctor?.latitude, doctor?.longitude, doctor?.profile?.full_name, t]);

  const hasCoordinates = locationData.latitude && locationData.longitude;

  if (!clinic && !hasCoordinates) {
    return (
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {t('doctorLocationMap.addressAndLocation')}
          </CardTitle>
          {isOwner && onEdit && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label={a11yLabel("edit")}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-lg bg-muted flex flex-col items-center justify-center gap-2">
            <MapPin className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">{t('doctorLocationMap.locationNotSet')}</p>
            {isOwner ? (
              <Button variant="outline" size="sm" onClick={onEdit}>
                {t('doctorLocationMap.setLocation')}
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">{t('doctorLocationMap.locationWillShow')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const openInMaps = () => {
    if (hasCoordinates) {
      window.open(
        `https://www.openstreetmap.org/?mlat=${locationData.latitude}&mlon=${locationData.longitude}#map=17/${locationData.latitude}/${locationData.longitude}`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.openstreetmap.org/search?query=${encodeURIComponent(locationData.address + ', ' + locationData.city)}`,
        '_blank'
      );
    }
  };

  const getDirections = () => {
    if (hasCoordinates) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${locationData.latitude},${locationData.longitude}`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationData.address + ', ' + locationData.city)}`,
        '_blank'
      );
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          {t('doctorLocationMap.addressAndLocation')}
        </CardTitle>
        {isOwner && onEdit && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label={a11yLabel("edit")}>
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="font-medium">{locationData.name}</p>
          {locationData.address && <p className="text-muted-foreground">{locationData.address}</p>}
          {locationData.city && <p className="text-sm text-muted-foreground">{locationData.city}</p>}
        </div>

        {hasCoordinates ? (
          <Suspense fallback={<div className="h-64 rounded-lg bg-muted animate-pulse" aria-label="Загрузка карты" />}>
            <DoctorLocationLeafletMap
              latitude={locationData.latitude!}
              longitude={locationData.longitude!}
              name={locationData.name}
              address={locationData.address}
            />
          </Suspense>
        ) : (
          <div className="h-64 rounded-lg bg-muted flex items-center justify-center">
            <p className="text-muted-foreground text-sm">{t('doctorLocationMap.coordsNotSet')}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={openInMaps}>
            <ExternalLink className="w-4 h-4" />
            {t('doctorLocationMap.openOnMap')}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={getDirections}>
            <Navigation className="w-4 h-4" />
            {t('doctorLocationMap.buildRoute')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
