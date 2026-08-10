import { lazy, Suspense, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ClinicProfileHeader } from '@/components/clinic/profile/ClinicProfileHeader';
import { ClinicProfileTabs } from '@/components/clinic/profile/ClinicProfileTabs';
import { ClinicTimeline } from '@/components/clinic/profile/ClinicTimeline';
import { ClinicDoctors } from '@/components/clinic/profile/ClinicDoctors';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PageMeta } from '@/components/PageMeta';
import { MedicalBusinessSchema, BreadcrumbListSchema } from '@/components/StructuredData';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ClinicDoctor, ClinicProfileData } from '@/components/clinic/profile/types';

const ClinicPortfolio = lazy(() =>
  import('@/components/clinic/profile/ClinicPortfolio').then((module) => ({ default: module.ClinicPortfolio })),
);
const ClinicReviews = lazy(() =>
  import('@/components/clinic/profile/ClinicReviews').then((module) => ({ default: module.ClinicReviews })),
);
const ClinicAbout = lazy(() =>
  import('@/components/clinic/profile/ClinicAbout').then((module) => ({ default: module.ClinicAbout })),
);
const ClinicServices = lazy(() =>
  import('@/components/clinic/profile/ClinicServices').then((module) => ({ default: module.ClinicServices })),
);
const ClinicSettings = lazy(() =>
  import('@/components/clinic/profile/ClinicSettings').then((module) => ({ default: module.ClinicSettings })),
);
const ProfileReels = lazy(() =>
  import('@/components/profile/ProfileReels').then((module) => ({ default: module.ProfileReels })),
);
const ProfileArticles = lazy(() =>
  import('@/components/profile/ProfileArticles').then((module) => ({ default: module.ProfileArticles })),
);

const profileTabFallback = (
  <div
    className="min-h-40 animate-pulse rounded-xl bg-card/60"
    role="status"
    aria-label="Загрузка вкладки"
  />
);
const clinicProfilePanelId = (tabId: string) => `clinic-profile-panel-${tabId}`;
const clinicProfileTabId = (tabId: string) => `clinic-profile-tab-${tabId}`;

const ClinicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const promotionId = searchParams.get('promo');
  const { toast } = useToast();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(promotionId ? 'doctors' : 'timeline');
  // Fetch clinic data
  const { data: clinic, isLoading, isError, refetch } = useQuery({
    queryKey: ['clinic', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', id)
        .eq('is_verified', true)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as ClinicProfileData;
    },
    enabled: !!id
  });

  // Fetch doctors for this clinic - both through clinic_id and clinic_members
  const { data: doctors } = useQuery({
    queryKey: ['clinic-doctors', id],
    queryFn: async () => {
      // Get doctors through clinic_id
      const { data: doctorsByClinicId } = await supabase
        .from('doctors')
        .select(`
          id,
          specialty,
          experience_years,
          price_from,
          rating,
          reviews_count,
          is_verified,
          images,
          user_id
        `)
        .eq('clinic_id', id)
        .eq('is_verified', true)
        .eq('is_accepting_patients', true);

      // Get doctors through clinic_members
      const { data: doctorMembers } = await supabase
        .from('clinic_members')
        .select('user_id')
        .eq('clinic_id', id)
        .eq('role', 'doctor');

      const memberUserIds = doctorMembers?.map(m => m.user_id) || [];
      
      // Get doctors by user_id from clinic_members
      let doctorsByMembers: ClinicDoctor[] = [];
      if (memberUserIds.length > 0) {
        const { data } = await supabase
          .from('doctors')
          .select(`
            id,
            specialty,
            experience_years,
            price_from,
            rating,
            reviews_count,
            is_verified,
            images,
            user_id
          `)
          .in('user_id', memberUserIds)
          .eq('is_verified', true)
          .eq('is_accepting_patients', true);
        
        doctorsByMembers = (data || []) as ClinicDoctor[];
      }

      // Combine and deduplicate doctors
      const allDoctors = [...((doctorsByClinicId || []) as ClinicDoctor[])];
      doctorsByMembers.forEach(doc => {
        if (!allDoctors.some(d => d.id === doc.id)) {
          allDoctors.push(doc);
        }
      });

      const userIds = allDoctors
        .map((doctor) => doctor.user_id)
        .filter((userId): userId is string => Boolean(userId));
      if (userIds.length === 0) return [];

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)
        .eq('is_active', true);
      if (profileError) throw profileError;
      const profiles = new Map(
        (profileRows || []).map((profile) => [
          profile.id,
          { full_name: profile.full_name, avatar_url: profile.avatar_url },
        ]),
      );

      return allDoctors
        .filter((doctor) => Boolean(doctor.user_id && profiles.has(doctor.user_id)))
        .map((doctor) => ({
          ...doctor,
          profiles: profiles.get(doctor.user_id!),
        }));
    },
    enabled: !!clinic?.id
  });

  // Check if user is clinic owner/admin
  const { data: isOwner } = useQuery({
    queryKey: ['clinic-owner', id, user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('clinic_members')
        .select('role')
        .eq('clinic_id', id)
        .eq('user_id', user.id)
        .in('role', ['clinic_admin', 'super_admin'])
        .maybeSingle();
      return !!data;
    },
    enabled: !!id && !!user?.id,
  });

  // Followers
  const { data: isFollowing, refetch: refetchFollowing } = useQuery({
    queryKey: ['clinic-following', id, user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('clinic_followers')
        .select('id')
        .eq('clinic_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!id && !!user?.id,
  });

  const { data: followersCount } = useQuery({
    queryKey: ['clinic-followers-count', id],
    queryFn: async () => {
      const { count } = await supabase
        .from('clinic_followers')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', id);
      return count || 0;
    },
    enabled: !!id,
  });

  // Reviews stats
  const { data: reviewsStats } = useQuery({
    queryKey: ['clinic-reviews-stats', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_reviews')
        .select('rating')
        .eq('clinic_id', id)
        .eq('is_approved', true);

      if (error) throw error;
      const total = data.length;
      const avg = total > 0 ? data.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      return { total, avg };
    },
    enabled: !!id,
  });

  const requireAuth = (action: string) => {
    toast({
      title: 'Требуется авторизация',
      description: `Чтобы ${action}, необходимо войти в аккаунт`,
      action: (
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="min-h-11 min-w-11 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Войти
        </button>
      ),
    });
  };

  const handleFollow = async () => {
    if (!user?.id) {
      requireAuth('подписаться на клинику');
      return;
    }
    
    if (isFollowing) {
      await supabase
        .from('clinic_followers')
        .delete()
        .eq('clinic_id', id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('clinic_followers')
        .insert({ clinic_id: id, user_id: user.id });
    }
    refetchFollowing();
  };

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-label="Загрузка клиники"
      >
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen overflow-x-clip bg-background">
        <Header />
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-bold mb-2">Не удалось загрузить клинику</h1>
          <p className="text-muted-foreground mb-6">Проверьте соединение и попробуйте ещё раз.</p>
          <Button className="min-h-11" onClick={() => refetch()}>Повторить</Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen overflow-x-clip bg-background">
        <Header />
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Клиника не найдена</h1>
          <Button asChild className="min-h-11">
            <Link to="/clinics">Вернуться к списку клиник</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  // ── SEO ──────────────────────────────────────────────────
  const canonicalUrl = `https://prodent.uz/clinic/${clinic.id}`;
  const seoTitle = `${clinic.name}${clinic.city ? `, ${clinic.city}` : ''} — ${t('nav.clinics')} | PRODENT`;
  const seoDescription =
    (clinic.description as string | undefined) ||
    [clinic.name, clinic.address, clinic.city].filter(Boolean).join(', ');
  const clinicImage = (clinic.logo_url || clinic.cover_url) as string | undefined;

  return (
    <div className="min-h-screen max-w-full overflow-x-clip bg-muted/30">
      <PageMeta
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        ogType="business.business"
        ogImage={clinicImage}
      />
      <MedicalBusinessSchema
        name={clinic.name}
        description={(clinic.description as string | undefined) || undefined}
        image={clinicImage}
        address={clinic.address}
        city={clinic.city}
        phone={(clinic.phone as string | undefined) || undefined}
        email={(clinic.email as string | undefined) || undefined}
        rating={(reviewsStats?.total || 0) > 0 ? reviewsStats?.avg : undefined}
        reviewCount={reviewsStats?.total || undefined}
        url={canonicalUrl}
        latitude={clinic.latitude != null ? Number(clinic.latitude) : undefined}
        longitude={clinic.longitude != null ? Number(clinic.longitude) : undefined}
      />
      <BreadcrumbListSchema
        items={[
          { name: t('nav.home'), url: 'https://prodent.uz/' },
          { name: t('nav.clinics'), url: 'https://prodent.uz/clinics' },
          { name: clinic.name, url: canonicalUrl },
        ]}
      />
      <Header />

      <main id="main-content" className="min-w-0 max-w-full pb-16">
        <ClinicProfileHeader
          clinic={{ ...clinic, doctors }}
          followersCount={followersCount || 0}
          isFollowing={isFollowing || false}
          onFollow={handleFollow}
          onMessage={() => {
            if (!user?.id) {
              requireAuth('написать клинике');
              return;
            }
            // For authenticated users, the chat will be handled inside the header component
          }}
          isOwner={isOwner || false}
          reviewsCount={reviewsStats?.total || 0}
          rating={reviewsStats?.avg || 0}
        />

        <ClinicProfileTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          isOwner={isOwner || false} 
        />

        <div className="mx-auto mt-6 min-w-0 max-w-5xl px-4">
          <div
            id={clinicProfilePanelId(activeTab)}
            role="tabpanel"
            aria-labelledby={clinicProfileTabId(activeTab)}
            tabIndex={0}
            className="min-w-0 max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {activeTab === 'timeline' && (
              <ClinicTimeline clinicId={clinic.id} clinic={clinic} isOwner={isOwner || false} />
            )}
            <Suspense fallback={profileTabFallback}>
              {activeTab === 'reels' && (
                <ProfileReels ownerType="clinic" ownerId={clinic.id} authorId={user?.id} isOwner={isOwner || false} />
              )}
              {activeTab === 'articles' && (
                <ProfileArticles ownerType="clinic" ownerId={clinic.id} authorId={user?.id} isOwner={isOwner || false} />
              )}
              {activeTab === 'portfolio' && (
                <ClinicPortfolio clinicId={clinic.id} isOwner={isOwner || false} />
              )}
            </Suspense>
            {activeTab === 'doctors' && (
              <ClinicDoctors doctors={doctors || []} promotionId={promotionId} />
            )}
            <Suspense fallback={profileTabFallback}>
              {activeTab === 'reviews' && (
                <ClinicReviews clinicId={clinic.id} />
              )}
              {activeTab === 'about' && (
                <ClinicAbout clinic={clinic} />
              )}
              {activeTab === 'services' && (
                <ClinicServices clinicId={clinic.id} />
              )}
              {activeTab === 'settings' && isOwner && (
                <ClinicSettings clinic={clinic} />
              )}
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ClinicProfile;
