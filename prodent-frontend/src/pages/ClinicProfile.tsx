import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ClinicProfileHeader } from '@/components/clinic/profile/ClinicProfileHeader';
import { ClinicProfileTabs } from '@/components/clinic/profile/ClinicProfileTabs';
import { ClinicTimeline } from '@/components/clinic/profile/ClinicTimeline';
import { ClinicPortfolio } from '@/components/clinic/profile/ClinicPortfolio';
import { ClinicDoctors } from '@/components/clinic/profile/ClinicDoctors';
import { ClinicReviews } from '@/components/clinic/profile/ClinicReviews';
import { ClinicAbout } from '@/components/clinic/profile/ClinicAbout';
import { ClinicServices } from '@/components/clinic/profile/ClinicServices';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ClinicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('timeline');
  // Fetch clinic data
  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
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
          verified,
          images,
          category,
          user_id,
          profiles:user_id (full_name, avatar_url)
        `)
        .eq('clinic_id', id);

      // Get doctors through clinic_members
      const { data: doctorMembers } = await supabase
        .from('clinic_members')
        .select('user_id')
        .eq('clinic_id', id)
        .eq('role', 'doctor');

      const memberUserIds = doctorMembers?.map(m => m.user_id) || [];
      
      // Get doctors by user_id from clinic_members
      let doctorsByMembers: any[] = [];
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
            verified,
            images,
            category,
            user_id,
            profiles:user_id (full_name, avatar_url)
          `)
          .in('user_id', memberUserIds);
        
        doctorsByMembers = data || [];
      }

      // Combine and deduplicate doctors
      const allDoctors = [...(doctorsByClinicId || [])];
      doctorsByMembers.forEach(doc => {
        if (!allDoctors.some(d => d.id === doc.id)) {
          allDoctors.push(doc);
        }
      });

      return allDoctors;
    },
    enabled: !!id
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
          onClick={() => navigate('/auth')}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90"
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Клиника не найдена</h1>
          <Link to="/clinics">
            <Button>Вернуться к списку клиник</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      
      <main className="pb-16">
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

        <div className="max-w-5xl mx-auto px-4 mt-6">
          {activeTab === 'timeline' && (
            <ClinicTimeline clinicId={clinic.id} clinic={clinic} isOwner={isOwner || false} />
          )}
          {activeTab === 'portfolio' && (
            <ClinicPortfolio clinicId={clinic.id} isOwner={isOwner || false} />
          )}
          {activeTab === 'doctors' && (
            <ClinicDoctors doctors={doctors || []} />
          )}
          {activeTab === 'reviews' && (
            <ClinicReviews clinicId={clinic.id} />
          )}
          {activeTab === 'about' && (
            <ClinicAbout clinic={clinic} />
          )}
          {activeTab === 'services' && (
            <ClinicServices clinicId={clinic.id} />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ClinicProfile;