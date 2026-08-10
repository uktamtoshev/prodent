import { lazy, Suspense, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Star, 
  Share2, 
  Phone,
  UserPlus, 
  UserMinus,
  Building2,
  Camera,
  Users,
  CheckCircle2,
  Globe,
  Mail,
  Navigation,
  MoreHorizontal,
  MessageCircle,
  Crown,
  Award,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useClinicBadges } from '@/hooks/useBadgeAssignments';
import { BadgeDisplay } from '@/components/badges/BadgeDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { ClinicChat } from './ClinicChat';
import { useActiveAddOns, type ActiveAddOn } from '@/hooks/useAddOnServices';
import type { ClinicProfileData } from './types';

const ClinicMiniMap = lazy(() =>
  import('./ClinicMiniMap').then((module) => ({ default: module.ClinicMiniMap })),
);

interface ClinicProfileHeaderProps {
  clinic: ClinicProfileData;
  followersCount: number;
  isFollowing: boolean;
  onFollow: () => void;
  onMessage?: () => void;
  isOwner: boolean;
  reviewsCount?: number;
  rating?: number;
}

export function ClinicProfileHeader({
  clinic,
  followersCount,
  isFollowing,
  onFollow,
  onMessage,
  isOwner,
  reviewsCount = 0,
  rating = 0,
}: ClinicProfileHeaderProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const clinicBadges = useClinicBadges(clinic?.id);
  const { data: activeAddOns } = useActiveAddOns('clinic', clinic?.id);
  
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  
  // Check for active add-ons
  const hasProfileFrame = activeAddOns?.some(addon => addon.service_type === 'profile_frame');
  const activeBadgeAddOns = activeAddOns?.filter(addon => addon.service_type === 'badge') || [];

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Ссылка скопирована',
        description: 'Ссылка на профиль скопирована в буфер обмена',
      });
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось скопировать ссылку',
        variant: 'destructive',
      });
    }
  };

  const uploadCover = async (file: File) => {
    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `clinics/${clinic.id}/cover_${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from('doctor-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('doctor-media')
        .getPublicUrl(data.path);

      const { error: updateError } = await supabase
        .from('clinics')
        .update({ cover_url: publicUrl.publicUrl })
        .eq('id', clinic.id);

      if (updateError) throw updateError;

      toast({ title: 'Обложка обновлена' });
      queryClient.invalidateQueries({ queryKey: ['clinic'] });
    } catch (error: unknown) {
      toast({ title: 'Ошибка', description: error instanceof Error ? error.message : 'Неизвестная ошибка', variant: 'destructive' });
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `clinics/${clinic.id}/logo_${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from('doctor-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('doctor-media')
        .getPublicUrl(data.path);

      const currentImages = clinic.images || [];
      const newImages = [publicUrl.publicUrl, ...currentImages.slice(1)];

      const { error: updateError } = await supabase
        .from('clinics')
        .update({ images: newImages })
        .eq('id', clinic.id);

      if (updateError) throw updateError;

      toast({ title: 'Логотип обновлен' });
      queryClient.invalidateQueries({ queryKey: ['clinic'] });
    } catch (error: unknown) {
      toast({ title: 'Ошибка', description: error instanceof Error ? error.message : 'Неизвестная ошибка', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Same default cover as the doctor profile header — shipped in /public.
  const coverImage = clinic.cover_url || '/doctor-cover-default.jpg';
  const logoImage = clinic.images?.[0];
  const hasLocation = clinic.latitude && clinic.longitude;
  
  // Check for Gold plan
  const isGoldPlan = clinic.subscription_plan === 'top' || clinic.subscription_plan === 'gold';
  
  // Determine if we should show premium frame (Gold plan OR active profile_frame add-on)
  const showPremiumFrame = isGoldPlan || hasProfileFrame;

  return (
    <div className={`max-w-full bg-card shadow-sm ${showPremiumFrame ? 'ring-4 ring-amber-500/30' : ''}`}>
      {/* Premium Banner - Gold plan or profile frame add-on */}
      {showPremiumFrame && (
        <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-4 py-2 text-sm font-medium text-foreground">
          {hasProfileFrame && !isGoldPlan ? (
            <>
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              <span>Премиум профиль</span>
              <Sparkles aria-hidden="true" className="h-4 w-4" />
            </>
          ) : (
            <>
              <Crown aria-hidden="true" className="h-4 w-4" />
              <span>Премиум клиника</span>
              <Crown aria-hidden="true" className="h-4 w-4" />
            </>
          )}
        </div>
      )}
      {/* Cover Image - Facebook style */}
      <div className="h-[200px] sm:h-[280px] md:h-[350px] relative overflow-hidden">
        <img
          src={coverImage}
          alt={`Обложка клиники ${clinic.name}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {isOwner && (
          <>
            <input
              id="clinic-cover-upload"
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Загрузить обложку клиники"
              onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4 min-h-11 max-w-[calc(100%-2rem)] gap-2 bg-card/95 text-foreground shadow-lg hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              aria-controls="clinic-cover-upload"
            >
              <Camera aria-hidden="true" className="h-4 w-4 shrink-0" />
              {uploadingCover ? 'Загрузка...' : 'Изменить обложку'}
            </Button>
          </>
        )}
      </div>

      {/* Profile Info - Facebook style */}
      <div className="mx-auto min-w-0 max-w-5xl px-4">
        <div className="relative pb-4">
          {/* Logo & Info */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative -mt-[84px] sm:-mt-[96px] self-center sm:self-auto z-10">
              <div className={`relative group ${showPremiumFrame ? 'p-1 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600' : ''}`}>
                <Avatar className={`w-[168px] h-[168px] sm:w-[176px] sm:h-[176px] border-4 ${showPremiumFrame ? 'border-amber-400' : 'border-card'} shadow-xl rounded-xl`}>
                  <AvatarImage src={logoImage} className="object-cover rounded-lg" />
                  <AvatarFallback className="text-5xl bg-primary text-primary-foreground rounded-lg">
                    <Building2 className="w-16 h-16" />
                  </AvatarFallback>
                </Avatar>
                {/* Premium Badge (Gold plan or frame add-on) */}
                {showPremiumFrame && (
                  <div className="absolute -right-2 -top-2 rounded-full border-2 border-card bg-gradient-to-br from-amber-400 to-amber-600 p-2 text-foreground shadow-lg">
                    {isGoldPlan ? (
                      <Crown aria-hidden="true" className="h-5 w-5" />
                    ) : (
                      <Sparkles aria-hidden="true" className="h-5 w-5" />
                    )}
                  </div>
                )}
                {/* Add-on Badges */}
                {activeBadgeAddOns.length > 0 && (
                  <div className="absolute -bottom-6 left-1/2 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-1 overflow-x-auto">
                    {activeBadgeAddOns.map((addon) => (
                      <Badge 
                        key={addon.add_on_id}
                        className="text-xs gap-1 shadow-md animate-in fade-in-0 zoom-in-95"
                        style={{ 
                          backgroundColor: addon.bg_color || 'hsl(var(--primary))', 
                          color: addon.color || 'white',
                          borderColor: addon.color || 'transparent'
                        }}
                      >
                        <Award className="w-3 h-3" />
                        {addon.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {/* Legacy Admin Badges */}
                {clinicBadges.length > 0 && activeBadgeAddOns.length === 0 && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <BadgeDisplay badges={clinicBadges} size="sm" maxBadges={2} />
                  </div>
                )}
                {isOwner && (
                  <>
                    <input
                      id="clinic-logo-upload"
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      aria-label="Загрузить логотип клиники"
                      onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-secondary text-secondary-foreground shadow-lg hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      aria-label="Изменить логотип клиники"
                      aria-controls="clinic-logo-upload"
                    >
                      {uploadingLogo ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera aria-hidden="true" className="h-5 w-5" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Name & Info */}
            <div className="min-w-0 flex-1 text-center sm:pb-4 sm:pt-2 sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="max-w-full break-words text-[28px] font-bold leading-tight text-foreground sm:text-[32px]">
                  {clinic.name}
                </h1>
              </div>

              {/* Category & Stats */}
              <p className="text-[17px] text-muted-foreground mb-2">Стоматологическая клиника</p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 text-[15px] text-muted-foreground">
                <span className="font-semibold text-foreground">{followersCount}</span>
                <span>подписчиков</span>
                {rating > 0 && (
                  <>
                    <span className="mx-1.5">•</span>
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
                    <span>({reviewsCount})</span>
                  </>
                )}
                <span className="mx-1.5">•</span>
                <Users className="w-4 h-4" />
                <span className="font-semibold text-foreground">{clinic.doctors?.length || 0}</span>
                <span>врачей</span>
              </div>
            </div>

            {/* Action Buttons - Facebook style */}
            <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-2 pb-4 sm:w-auto sm:justify-end">
              {!isOwner && (
                <>
                  <Button
                    variant={isFollowing ? "secondary" : "default"}
                    onClick={onFollow}
                    className={`min-h-11 gap-2 px-6 font-semibold ${isFollowing ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : ''}`}
                  >
                    {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {isFollowing ? 'Отписаться' : 'Подписаться'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-11 gap-2 bg-secondary font-semibold text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => {
                      if (!user) {
                        // Call onMessage for auth check (will show toast)
                        onMessage?.();
                      } else {
                        setShowChat(true);
                      }
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Написать</span>
                  </Button>
                </>
              )}
              {clinic.phone && (
                showPhone ? (
                  <a 
                    href={`tel:${clinic.phone}`}
                    className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-2 rounded-md bg-primary/10 px-4 py-2 font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span className="break-all">{clinic.phone}</span>
                  </a>
                ) : (
                  <Button
                    variant="secondary"
                    className="min-h-11 gap-2 bg-secondary font-semibold text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => setShowPhone(true)}
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline">Показать номер</span>
                  </Button>
                )
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 bg-secondary hover:bg-secondary/80"
                    aria-label="Дополнительные действия"
                  >
                    <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="min-h-11" onClick={handleShare}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Поделиться
                  </DropdownMenuItem>
                  {clinic.email && (
                    <DropdownMenuItem className="min-h-11" onClick={() => window.open(`mailto:${clinic.email}`)}>
                      <Mail className="w-4 h-4 mr-2" />
                      Написать email
                    </DropdownMenuItem>
                  )}
                  {clinic.website && (
                    <DropdownMenuItem className="min-h-11" onClick={() => window.open(clinic.website, '_blank')}>
                      <Globe className="w-4 h-4 mr-2" />
                      Открыть сайт
                    </DropdownMenuItem>
                  )}
                  {hasLocation && (
                    <DropdownMenuItem className="min-h-11" onClick={() => window.open(`https://www.google.com/maps?q=${clinic.latitude},${clinic.longitude}`, '_blank')}>
                      <Navigation className="w-4 h-4 mr-2" />
                      Маршрут
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Location bar with mini map */}
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 pt-4 mt-4 border-t border-border">
            {/* Address info */}
            <div className="flex-1 flex flex-col justify-center text-[15px]">
              <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-primary font-medium">{clinic.city}{clinic.district && `, ${clinic.district}`}</span>
                <span className="mx-1">•</span>
                <span className="text-foreground">{clinic.address}</span>
              </div>
              {clinic.landmark && (
                <Badge variant="secondary" className="w-fit mt-2">
                  Ориентир: {clinic.landmark}
                </Badge>
              )}
              {hasLocation && (
                <a 
                  href={`https://www.google.com/maps?q=${clinic.latitude},${clinic.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-11 min-w-11 items-center gap-1 rounded-md font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Navigation className="w-4 h-4" />
                  Построить маршрут
                </a>
              )}
            </div>

            {/* Mini map */}
            {hasLocation && (
              <div className="w-full lg:w-72 h-32 rounded-xl overflow-hidden border border-border shadow-sm">
                <Suspense fallback={<div className="w-full h-full bg-muted animate-pulse" aria-label="Загрузка карты" />}>
                  <ClinicMiniMap latitude={clinic.latitude!} longitude={clinic.longitude!} />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {showChat && user && (
        <ClinicChat
          clinicId={clinic.id}
          patientId={user.id}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
