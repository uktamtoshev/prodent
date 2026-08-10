import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CRMLayout } from "@/components/crm/CRMLayout";
import { ProfilePersonalInfo } from '@/components/crm/profile/ProfilePersonalInfo';
import { ProfilePrivacySettings } from '@/components/crm/profile/ProfilePrivacySettings';
import { ProfileReviews } from '@/components/crm/profile/ProfileReviews';
import { ProfileGallery } from '@/components/crm/profile/ProfileGallery';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Images, MessageSquare, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CRMProfile() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: doctorData, isLoading } = useQuery({
    queryKey: ['crm-doctor-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Backend doesn't support embedded resource syntax — fetch separately
      const { data: doctor, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!doctor) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      return { ...doctor, profile: profile || null };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <CRMLayout>
        <div className="space-y-section p-4 lg:p-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </CRMLayout>
    );
  }

  if (!doctorData) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="py-16 text-center text-muted-foreground">
              <User className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <h2 className="mb-2 text-lg font-medium">{t("crmProfile.notFound")}</h2>
              <p className="text-sm">{t("crmProfile.notFoundDesc")}</p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="space-y-section p-4 lg:p-6">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crmProfile.title")}</h1>
            <p className="text-muted-foreground">
              {t("crmProfile.description")}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="personal" className="space-y-section">
          <TabsList className="h-auto flex-wrap gap-0.5 p-1">
            <TabsTrigger
              value="personal"
              className="gap-2"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{t("crmProfile.tabPersonal")}</span>
              <span className="sm:hidden">{t("crmProfile.tabPersonalShort")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="gallery"
              className="gap-2"
            >
              <Images className="w-4 h-4" />
              <span className="hidden sm:inline">{t("crmProfile.tabGallery")}</span>
              <span className="sm:hidden">{t("crmProfile.tabGalleryShort")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              {t("crmProfile.tabReviews")}
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="gap-2"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">{t("crmProfile.tabPrivacy")}</span>
              <span className="sm:hidden">{t("crmProfile.tabPrivacyShort")}</span>
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
