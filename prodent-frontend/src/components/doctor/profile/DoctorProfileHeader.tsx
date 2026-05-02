import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  MapPin, 
  Star,
  Share2, 
  MessageCircle, 
  UserPlus, 
  UserMinus,
  Building2,
  Camera,
  Pencil,
  Check,
  X,
  Verified,
  Users,
  MoreHorizontal,
  Briefcase,
  Phone,
  Eye,
  Crown,
  Award,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDoctorBadges } from '@/hooks/useBadgeAssignments';
import { BadgeDisplay } from '@/components/badges/BadgeDisplay';
import { useActiveAddOns, type ActiveAddOn } from '@/hooks/useAddOnServices';

interface DoctorProfileHeaderProps {
  doctor: any;
  followersCount: number;
  isFollowing: boolean;
  onFollow: () => void;
  onMessage: () => void;
  isOwner: boolean;
  isViewerDoctor?: boolean;
}

export function DoctorProfileHeader({
  doctor,
  followersCount,
  isFollowing,
  onFollow,
  onMessage,
  isOwner,
  isViewerDoctor = false,
}: DoctorProfileHeaderProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const doctorBadges = useDoctorBadges(doctor.id);
  const { data: activeAddOns } = useActiveAddOns('doctor', doctor.id);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(doctor.profile?.full_name || '');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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

  const updateName = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editedName })
        .eq('id', doctor.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Имя обновлено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
      setIsEditingName(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const uploadCover = async (file: File) => {
    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${doctor.id}/cover_${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from('doctor-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('doctor-media')
        .getPublicUrl(data.path);

      const { error: updateError } = await supabase
        .from('doctors')
        .update({ cover_image: publicUrl.publicUrl })
        .eq('id', doctor.id);

      if (updateError) throw updateError;

      toast({ title: 'Обложка обновлена' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${doctor.user_id}/${Date.now()}.${ext}`;

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
        .eq('id', doctor.user_id);

      if (updateError) throw updateError;

      toast({ title: 'Фото профиля обновлено' });
      queryClient.invalidateQueries({ queryKey: ['doctor-public-profile'] });
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const coverImage = doctor.cover_image || 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&h=400&fit=crop';
  
  // Check for Gold plan
  const isGoldPlan = doctor.subscription_plan === 'top' || doctor.subscription_plan === 'gold';

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
              <span>Премиум врач</span>
              <Crown className="w-4 h-4" />
            </>
          )}
        </div>
      )}
      {/* Cover Image - Facebook style gradient overlay */}
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
          {/* Avatar - overlapping the cover */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative -mt-[84px] sm:-mt-[96px] self-center sm:self-auto z-10">
              <div className={`relative ${showPremiumFrame ? 'p-1 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600' : ''}`}>
                <Avatar className={`w-[168px] h-[168px] sm:w-[176px] sm:h-[176px] border-4 ${showPremiumFrame ? 'border-amber-400' : 'border-card'} shadow-xl`}>
                  <AvatarImage src={doctor.profile?.avatar_url} className="object-cover" />
                  <AvatarFallback className="text-5xl bg-primary text-primary-foreground font-bold">
                    {doctor.profile?.full_name?.charAt(0) || 'D'}
                  </AvatarFallback>
                </Avatar>
              </div>
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
              {doctorBadges.length > 0 && activeBadgeAddOns.length === 0 && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <BadgeDisplay badges={doctorBadges} size="sm" maxBadges={2} />
                </div>
              )}
              {isOwner && (
                <>
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
                    className="absolute bottom-3 right-3 rounded-full w-9 h-9 shadow-lg bg-gray-100 hover:bg-gray-200"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-gray-700" />
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Name & Info */}
            <div className="flex-1 text-center sm:text-left sm:pb-4 sm:pt-2">
              {/* Name */}
              {isOwner && isEditingName ? (
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="text-2xl font-bold h-auto py-1 px-2 max-w-[280px] border-primary"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateName.mutate()} disabled={updateName.isPending}>
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setIsEditingName(false); setEditedName(doctor.profile?.full_name || ''); }}>
                    <X className="w-4 h-4 text-gray-500" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start gap-2 group mb-1">
                  <h1 className="text-[28px] sm:text-[32px] font-bold text-foreground leading-tight">
                    {doctor.profile?.full_name || 'Врач'}
                  </h1>
                  {isOwner && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={() => setIsEditingName(true)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* Specialty & Stats */}
              <p className="text-[17px] text-muted-foreground mb-2">{doctor.specialty}</p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 text-[15px] text-muted-foreground">
                <span className="font-semibold text-foreground">{followersCount}</span>
                <span>подписчиков</span>
                {doctor.rating > 0 && (
                  <>
                    <span className="mx-1.5">•</span>
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-foreground">{doctor.rating}</span>
                    <span>({doctor.reviews_count})</span>
                  </>
                )}
                <span className="mx-1.5">•</span>
                <Briefcase className="w-4 h-4" />
                <span>{doctor.experience_years} лет опыта</span>
              </div>
            </div>

            {/* Action Buttons - Facebook style */}
            <div className="flex items-center justify-center sm:justify-end gap-2 pb-4">
              {!isOwner && (
                <>
                  {!isViewerDoctor && (
                    <Button 
                      variant="secondary" 
                      onClick={onMessage} 
                      className="gap-2 bg-gray-100 hover:bg-gray-200 text-foreground font-semibold"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Написать
                    </Button>
                  )}
                  <Button
                    variant={isFollowing ? "secondary" : "outline"}
                    onClick={onFollow}
                    className={`gap-2 font-semibold ${isFollowing ? 'bg-gray-100 hover:bg-gray-200' : ''}`}
                  >
                    {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {isFollowing ? 'Отписаться' : 'Подписаться'}
                  </Button>
                </>
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Location & Contact bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 mt-3 border-t border-border text-[15px]">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
              {doctor.clinic && (
                <>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>Работает в <span className="text-foreground font-medium hover:underline cursor-pointer">{doctor.clinic.name}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{doctor.clinic.city}</span>
                  </div>
                </>
              )}
            </div>
            
            {/* Phone contact */}
            {doctor.profile?.phone && (
              <div className="flex items-center justify-center sm:justify-end">
                {showPhone ? (
                  <a 
                    href={`tel:${doctor.profile.phone}`}
                    className="flex items-center gap-2 text-primary font-medium hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    {doctor.profile.phone}
                  </a>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPhone(true)}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Показать номер
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
