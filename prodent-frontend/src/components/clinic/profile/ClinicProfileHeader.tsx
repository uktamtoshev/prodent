import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
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
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useClinicBadges } from '@/hooks/useBadgeAssignments';
import { BadgeDisplay } from '@/components/badges/BadgeDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { ClinicChat } from './ClinicChat';
import { useActiveAddOns, type ActiveAddOn } from '@/hooks/useAddOnServices';

interface ClinicProfileHeaderProps {
  clinic: any;
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
  const miniMapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const clinicBadges = useClinicBadges(clinic?.id);
  const { data: activeAddOns } = useActiveAddOns('clinic', clinic?.id);
  
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  
  // Check for active add-ons
  const hasProfileFrame = activeAddOns?.some(addon => addon.service_type === 'profile_frame');
  const activeBadgeAddOns = activeAddOns?.filter(addon => addon.service_type === 'badge') || [];

  useEffect(() => {
    if (!miniMapRef.current || !clinic?.latitude || !clinic?.longitude) return;
    if (map.current) return;

    map.current = L.map(miniMapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    }).setView([clinic.latitude, clinic.longitude], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map.current);

    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="background: linear-gradient(135deg, #1877f2 0%, #166fe5 100%); width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 8px rgba(24, 119, 242, 0.5);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    L.marker([clinic.latitude, clinic.longitude], { icon: customIcon }).addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [clinic?.latitude, clinic?.longitude]);

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
        .update({ cover_image: publicUrl.publicUrl })
        .eq('id', clinic.id);

      if (updateError) throw updateError;

      toast({ title: 'Обложка обновлена' });
      queryClient.invalidateQueries({ queryKey: ['clinic'] });
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
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
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const coverImage = clinic.cover_image || 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&h=400&fit=crop';
  const logoImage = clinic.images?.[0];
  const hasLocation = clinic.latitude && clinic.longitude;
  
  // Check for Gold plan
  const isGoldPlan = clinic.subscription_plan === 'top' || clinic.subscription_plan === 'gold';
  
  // Determine if we should show premium frame (Gold plan OR active profile_frame add-on)
  const showPremiumFrame = isGoldPlan || hasProfileFrame;

  return (
    <div className={`bg-card shadow-sm ${showPremiumFrame ? 'ring-4 ring-amber-500/30' : ''}`}>
      {/* Premium Banner - Gold plan or profile frame add-on */}
      {showPremiumFrame && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium">
          {hasProfileFrame && !isGoldPlan ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Премиум профиль</span>
              <Sparkles className="w-4 h-4" />
            </>
          ) : (
            <>
              <Crown className="w-4 h-4" />
              <span>Премиум клиника</span>
              <Crown className="w-4 h-4" />
            </>
          )}
        </div>
      )}
      {/* Cover Image - Facebook style */}
      <div className="h-[200px] sm:h-[280px] md:h-[350px] relative overflow-hidden">
        <img
          src={coverImage}
          alt="Cover"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {isOwner && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4 gap-2 bg-white/90 hover:bg-white text-gray-800 shadow-lg"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
            >
              <Camera className="w-4 h-4" />
              {uploadingCover ? 'Загрузка...' : 'Изменить обложку'}
            </Button>
          </>
        )}
      </div>

      {/* Profile Info - Facebook style */}
      <div className="max-w-5xl mx-auto px-4">
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
                  <div className="absolute -top-2 -right-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full p-2 shadow-lg border-2 border-white">
                    {isGoldPlan ? <Crown className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
                  </div>
                )}
                {/* Add-on Badges */}
                {activeBadgeAddOns.length > 0 && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1">
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
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-3 right-3 rounded-full w-9 h-9 shadow-lg bg-gray-100 hover:bg-gray-200"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 text-gray-700" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Name & Info */}
            <div className="flex-1 text-center sm:text-left sm:pb-4 sm:pt-2">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-[28px] sm:text-[32px] font-bold text-foreground leading-tight">
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
            <div className="flex items-center justify-center sm:justify-end gap-2 pb-4">
              {!isOwner && (
                <>
                  <Button
                    variant={isFollowing ? "secondary" : "default"}
                    onClick={onFollow}
                    className={`gap-2 font-semibold px-6 ${isFollowing ? 'bg-gray-100 hover:bg-gray-200 text-foreground' : ''}`}
                  >
                    {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {isFollowing ? 'Отписаться' : 'Подписаться'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="gap-2 bg-gray-100 hover:bg-gray-200 text-foreground font-semibold"
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
                    className="inline-flex items-center gap-2 bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-4 py-2 rounded-md transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {clinic.phone}
                  </a>
                ) : (
                  <Button
                    variant="secondary"
                    className="gap-2 bg-gray-100 hover:bg-gray-200 text-foreground font-semibold"
                    onClick={() => setShowPhone(true)}
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline">Показать номер</span>
                  </Button>
                )
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" className="bg-gray-100 hover:bg-gray-200">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleShare}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Поделиться
                  </DropdownMenuItem>
                  {clinic.email && (
                    <DropdownMenuItem onClick={() => window.open(`mailto:${clinic.email}`)}>
                      <Mail className="w-4 h-4 mr-2" />
                      Написать email
                    </DropdownMenuItem>
                  )}
                  {clinic.website && (
                    <DropdownMenuItem onClick={() => window.open(clinic.website, '_blank')}>
                      <Globe className="w-4 h-4 mr-2" />
                      Открыть сайт
                    </DropdownMenuItem>
                  )}
                  {hasLocation && (
                    <DropdownMenuItem onClick={() => window.open(`https://www.google.com/maps?q=${clinic.latitude},${clinic.longitude}`, '_blank')}>
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
                  className="text-primary hover:underline font-medium mt-2 inline-flex items-center gap-1"
                >
                  <Navigation className="w-4 h-4" />
                  Построить маршрут
                </a>
              )}
            </div>

            {/* Mini map */}
            {hasLocation && (
              <div className="w-full lg:w-72 h-32 rounded-xl overflow-hidden border border-border shadow-sm">
                <div ref={miniMapRef} className="w-full h-full" />
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
