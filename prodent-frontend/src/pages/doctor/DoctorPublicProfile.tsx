import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { DoctorProfileHeader } from '@/components/doctor/profile/DoctorProfileHeader';
import { DoctorProfileTabs } from '@/components/doctor/profile/DoctorProfileTabs';
import { DoctorTimeline } from '@/components/doctor/profile/DoctorTimeline';
import { DoctorPortfolio } from '@/components/doctor/profile/DoctorPortfolio';
import { DoctorReviews } from '@/components/doctor/profile/DoctorReviews';
import { DoctorAbout } from '@/components/doctor/profile/DoctorAbout';
import { DoctorServices } from '@/components/doctor/profile/DoctorServices';
import { DoctorSettings } from '@/components/doctor/profile/DoctorSettings';
import { DoctorChat } from '@/components/doctor/profile/DoctorChat';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DoctorPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('timeline');
  const [showChat, setShowChat] = useState(false);
  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor-public-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          *,
          profile:profiles!doctors_user_id_fkey(full_name, avatar_url, phone, email),
          clinic:clinics(name, address, phone, city, latitude, longitude)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Check if current user is also a doctor
  const { data: currentUserDoctor } = useQuery({
    queryKey: ['current-user-doctor', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: isFollowing, refetch: refetchFollowing } = useQuery({
    queryKey: ['doctor-following', id, user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('doctor_followers')
        .select('id')
        .eq('doctor_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!id && !!user?.id,
  });

  const { data: followersCount } = useQuery({
    queryKey: ['doctor-followers-count', id],
    queryFn: async () => {
      const { count } = await supabase
        .from('doctor_followers')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', id);
      return count || 0;
    },
    enabled: !!id,
  });

  const isOwner = user?.id === doctor?.user_id;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 animate-pulse" />
            <Loader2 className="h-8 w-8 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-muted-foreground animate-pulse">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
              <span className="text-4xl">👨‍⚕️</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Врач не найден</h1>
            <p className="text-muted-foreground">Возможно, профиль был удалён или ссылка устарела</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

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
      requireAuth('подписаться на врача');
      return;
    }
    
    if (isFollowing) {
      await supabase
        .from('doctor_followers')
        .delete()
        .eq('doctor_id', id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('doctor_followers')
        .insert({ doctor_id: id, user_id: user.id });
    }
    refetchFollowing();
  };

  const handleMessage = () => {
    if (!user?.id) {
      requireAuth('написать врачу');
      return;
    }
    setShowChat(true);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      
      <main className="pb-16">
        <DoctorProfileHeader
          doctor={doctor}
          followersCount={followersCount || 0}
          isFollowing={isFollowing || false}
          onFollow={handleFollow}
          onMessage={handleMessage}
          isOwner={isOwner}
          isViewerDoctor={!!currentUserDoctor}
        />

        <DoctorProfileTabs activeTab={activeTab} onTabChange={setActiveTab} isOwner={isOwner} />

        <div className="max-w-5xl mx-auto px-4 mt-6">
          {activeTab === 'timeline' && <DoctorTimeline doctorId={doctor.id} isOwner={isOwner} />}
          {activeTab === 'portfolio' && <DoctorPortfolio doctorId={doctor.id} isOwner={isOwner} />}
          {activeTab === 'reviews' && <DoctorReviews doctorId={doctor.id} />}
          {activeTab === 'about' && <DoctorAbout doctor={doctor} isOwner={isOwner} />}
          {activeTab === 'services' && <DoctorServices doctorId={doctor.id} />}
          {activeTab === 'settings' && isOwner && <DoctorSettings />}
        </div>
      </main>

      {showChat && user && (
        <DoctorChat
          doctorId={doctor.id}
          patientId={user.id}
          onClose={() => setShowChat(false)}
          senderDoctorId={currentUserDoctor?.id}
        />
      )}

      <Footer />
    </div>
  );
}
