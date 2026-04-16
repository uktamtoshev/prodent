import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CRMLayout } from "@/components/crm/CRMLayout";
import { ProfilePersonalInfo } from '@/components/crm/profile/ProfilePersonalInfo';
import { ProfilePrivacySettings } from '@/components/crm/profile/ProfilePrivacySettings';
import { ProfileReviews } from '@/components/crm/profile/ProfileReviews';
import { ProfileGallery } from '@/components/crm/profile/ProfileGallery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Images, MessageSquare, Shield } from 'lucide-react';

export default function CRMProfile() {
  const { user } = useAuth();

  const { data: doctorData, isLoading } = useQuery({
    queryKey: ['crm-doctor-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data: doctor, error } = await supabase
        .from('doctors')
        .select(`
          *,
          profile:profiles!doctors_user_id_fkey(*)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return doctor;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      </CRMLayout>
    );
  }

  if (!doctorData) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8">
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-lg font-medium mb-2">Профиль врача не найден</h2>
            <p className="text-sm">Обратитесь к администратору для настройки профиля</p>
          </div>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="font-heading text-foreground text-2xl">Мой профиль</h1>
          <p className="text-muted-foreground mt-1">
            Управление профилем, галереей работ и настройками приватности
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
            <TabsTrigger 
              value="personal" 
              className="gap-2 data-[state=active]:bg-background"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Личные данные</span>
              <span className="sm:hidden">Профиль</span>
            </TabsTrigger>
            <TabsTrigger 
              value="gallery" 
              className="gap-2 data-[state=active]:bg-background"
            >
              <Images className="w-4 h-4" />
              <span className="hidden sm:inline">Галерея работ</span>
              <span className="sm:hidden">Галерея</span>
            </TabsTrigger>
            <TabsTrigger 
              value="reviews" 
              className="gap-2 data-[state=active]:bg-background"
            >
              <MessageSquare className="w-4 h-4" />
              Отзывы
            </TabsTrigger>
            <TabsTrigger 
              value="privacy" 
              className="gap-2 data-[state=active]:bg-background"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Приватность</span>
              <span className="sm:hidden">Настройки</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal" className="mt-6">
            <ProfilePersonalInfo 
              doctor={doctorData} 
              profile={doctorData.profile} 
            />
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="mt-6">
            <ProfileGallery doctorId={doctorData.id} />
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="mt-6">
            <ProfileReviews doctorId={doctorData.id} />
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="mt-6">
            <ProfilePrivacySettings doctor={doctorData} />
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
