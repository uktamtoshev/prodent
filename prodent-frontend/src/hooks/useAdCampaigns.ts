import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdPackage {
  id: string;
  name: string;
  name_uz?: string;
  name_en?: string;
  description?: string;
  duration_days: number;
  price: number;
  currency: string;
  package_type: 'top_day' | 'top_week' | 'top_month' | 'banner';
  target_type: 'doctor' | 'clinic';
  is_active: boolean;
  max_slots: number;
}

export interface AdCampaign {
  id: string;
  package_id: string;
  doctor_id?: string;
  clinic_id?: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';
  priority: number;
  amount_paid: number;
  currency: string;
  payment_date?: string;
  payment_method?: string;
  payment_notes?: string;
  created_by?: string;
  created_at: string;
  // Joined data
  package?: AdPackage;
  doctor?: { id: string; user_id: string; specialty: string; rating?: number; experience_years?: number; price_from?: number; profiles?: { full_name: string; avatar_url?: string } };
  clinic?: { id: string; name: string; city?: string; address?: string };
}

export interface AdAnalytics {
  id: string;
  campaign_id: string;
  event_type: 'impression' | 'profile_view' | 'banner_click' | 'appointment_started' | 'appointment_completed';
  user_id?: string;
  session_id?: string;
  page_url?: string;
  created_at: string;
}

// Fetch all ad packages
export const useAdPackages = (targetType?: 'doctor' | 'clinic') => {
  return useQuery({
    queryKey: ['ad-packages', targetType],
    queryFn: async () => {
      let query = supabase
        .from('ad_packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (targetType) {
        query = query.eq('target_type', targetType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdPackage[];
    },
  });
};

// Fetch all campaigns (admin)
export const useAdCampaigns = (status?: string) => {
  return useQuery({
    queryKey: ['ad-campaigns', status],
    queryFn: async () => {
      let query = supabase
        .from('ad_campaigns')
        .select(`
          *,
          package:ad_packages(*),
          doctor:doctors(id, user_id, specialty, profiles:profiles!doctors_user_id_fkey(full_name, avatar_url)),
          clinic:clinics(id, name)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdCampaign[];
    },
  });
};

// Fetch active campaigns for display (random rotation)
export const useActiveBannerCampaigns = (targetType: 'doctor' | 'clinic') => {
  return useQuery({
    queryKey: ['active-banner-campaigns', targetType],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      let query = supabase
        .from('ad_campaigns')
        .select(`
          *,
          package:ad_packages(*),
          doctor:doctors(id, user_id, specialty, rating, experience_years, price_from, profiles:profiles!doctors_user_id_fkey(full_name, avatar_url)),
          clinic:clinics(id, name, address, city)
        `)
        .eq('status', 'active')
        .lte('start_date', now)
        .gte('end_date', now);

      if (targetType === 'doctor') {
        query = query.not('doctor_id', 'is', null);
      } else {
        query = query.not('clinic_id', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Shuffle for random rotation
      return (data || []).sort(() => Math.random() - 0.5) as AdCampaign[];
    },
    staleTime: 60000, // 1 minute
  });
};

// Create campaign (admin only)
export const useCreateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: Omit<AdCampaign, 'id' | 'created_at' | 'package' | 'doctor' | 'clinic'>) => {
      const { data, error } = await supabase
        .from('ad_campaigns')
        .insert(campaign)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      toast.success('Рекламная кампания создана');
    },
    onError: (error) => {
      toast.error('Ошибка создания кампании: ' + error.message);
    },
  });
};

// Update campaign status
export const useUpdateCampaignStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('ad_campaigns')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      toast.success('Статус обновлён');
    },
  });
};

// Track analytics event
export const useTrackAdEvent = () => {
  return useMutation({
    mutationFn: async (event: Omit<AdAnalytics, 'id' | 'created_at'>) => {
      const { error } = await supabase
        .from('ad_analytics')
        .insert({
          ...event,
          session_id: sessionStorage.getItem('session_id') || crypto.randomUUID(),
          page_url: window.location.href,
        });

      if (error) throw error;
    },
  });
};

// Get campaign analytics
export const useCampaignAnalytics = (campaignId: string) => {
  return useQuery({
    queryKey: ['campaign-analytics', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_analytics')
        .select('event_type, created_at')
        .eq('campaign_id', campaignId);

      if (error) throw error;

      // Aggregate stats
      const stats = {
        impressions: 0,
        profile_views: 0,
        banner_clicks: 0,
        appointments_started: 0,
        appointments_completed: 0,
      };

      data?.forEach((event) => {
        switch (event.event_type) {
          case 'impression':
            stats.impressions++;
            break;
          case 'profile_view':
            stats.profile_views++;
            break;
          case 'banner_click':
            stats.banner_clicks++;
            break;
          case 'appointment_started':
            stats.appointments_started++;
            break;
          case 'appointment_completed':
            stats.appointments_completed++;
            break;
        }
      });

      return stats;
    },
  });
};

// Get all campaigns analytics summary
export const useAllCampaignsAnalytics = () => {
  return useQuery({
    queryKey: ['all-campaigns-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_analytics')
        .select('campaign_id, event_type');

      if (error) throw error;

      const byId: Record<string, typeof stats> = {};
      const stats = {
        impressions: 0,
        profile_views: 0,
        banner_clicks: 0,
        appointments_started: 0,
        appointments_completed: 0,
      };

      data?.forEach((event) => {
        if (!byId[event.campaign_id]) {
          byId[event.campaign_id] = { ...stats };
        }
        const s = byId[event.campaign_id];
        switch (event.event_type) {
          case 'impression': s.impressions++; break;
          case 'profile_view': s.profile_views++; break;
          case 'banner_click': s.banner_clicks++; break;
          case 'appointment_started': s.appointments_started++; break;
          case 'appointment_completed': s.appointments_completed++; break;
        }
      });

      return byId;
    },
  });
};
