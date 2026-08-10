import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { DoctorPortfolio } from '@/components/doctor/profile/DoctorPortfolio';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

export default function DoctorMedia() {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Get doctor ID for current user
  const { data: doctorData, isLoading } = useQuery({
    queryKey: ['doctor-profile-for-media', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <DoctorLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
      </DoctorLayout>
    );
  }

  if (!doctorData?.id) {
    return (
      <DoctorLayout>
        <div className="p-card-x">
          <p className="text-muted-foreground">{t("doctorMedia.profileNotFound")}</p>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="p-card-x">
        <DoctorPortfolio doctorId={doctorData.id} isOwner={true} />
      </div>
    </DoctorLayout>
  );
}
