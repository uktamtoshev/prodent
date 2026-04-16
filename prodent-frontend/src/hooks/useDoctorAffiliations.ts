import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CooperationType = 'staff_doctor' | 'chair_rental';

export interface DoctorClinicAffiliation {
  id: string;
  doctor_id: string;
  clinic_id: string;
  cooperation_type: CooperationType;
  salary_percent: number;
  rental_fee: number;
  rental_period: 'daily' | 'weekly' | 'monthly';
  is_active: boolean;
  is_primary: boolean;
  start_date: string | null;
  end_date: string | null;
  working_hours: Record<string, unknown>;
  notes: string | null;
  contract_number: string | null;
  clinic?: {
    id: string;
    name: string;
    address: string;
    city: string;
  };
}

interface UseDoctorAffiliationsResult {
  affiliations: DoctorClinicAffiliation[];
  loading: boolean;
  error: Error | null;
  primaryClinicId: string | null;
  getAffiliationForClinic: (clinicId: string) => DoctorClinicAffiliation | undefined;
  isAffiliatedWith: (clinicId: string) => boolean;
  getCooperationType: (clinicId: string) => CooperationType | null;
  getSalaryPercent: (clinicId: string) => number;
  refetch: () => void;
}

export function useDoctorAffiliations(): UseDoctorAffiliationsResult {
  const { user } = useAuth();

  const { 
    data: affiliations = [], 
    isLoading: loading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['doctor-affiliations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // First get doctor ID for current user
      const { data: doctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!doctor) return [];

      // Get all affiliations with clinic info
      const { data, error } = await supabase
        .from('doctor_clinic_affiliations')
        .select(`
          *,
          clinic:clinic_id(id, name, address, city)
        `)
        .eq('doctor_id', doctor.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return (data || []) as DoctorClinicAffiliation[];
    },
    enabled: !!user?.id,
  });

  const primaryClinicId = affiliations.find(a => a.is_primary)?.clinic_id || 
                          affiliations[0]?.clinic_id || 
                          null;

  const getAffiliationForClinic = (clinicId: string) => {
    return affiliations.find(a => a.clinic_id === clinicId);
  };

  const isAffiliatedWith = (clinicId: string) => {
    return affiliations.some(a => a.clinic_id === clinicId && a.is_active);
  };

  const getCooperationType = (clinicId: string): CooperationType | null => {
    const affiliation = getAffiliationForClinic(clinicId);
    return affiliation?.cooperation_type || null;
  };

  const getSalaryPercent = (clinicId: string): number => {
    const affiliation = getAffiliationForClinic(clinicId);
    return affiliation?.salary_percent ?? 30;
  };

  return {
    affiliations,
    loading,
    error: error as Error | null,
    primaryClinicId,
    getAffiliationForClinic,
    isAffiliatedWith,
    getCooperationType,
    getSalaryPercent,
    refetch,
  };
}

// Hook to get affiliations for a specific clinic (for clinic admins)
export function useClinicDoctorAffiliations(clinicId: string | undefined) {
  return useQuery({
    queryKey: ['clinic-doctor-affiliations', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];

      const { data, error } = await supabase
        .from('doctor_clinic_affiliations')
        .select(`
          *,
          doctor:doctor_id(
            id,
            specialty,
            experience_years,
            verified,
            profiles:user_id(full_name, avatar_url, phone)
          )
        `)
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clinicId,
  });
}
