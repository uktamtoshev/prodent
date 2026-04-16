import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";

export interface ClinicDoctor {
  id: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    avatar_url?: string | null;
  } | null;
}

/**
 * Hook to load doctors for the current clinic.
 * Uses BOTH legacy doctors.clinic_id AND doctor_clinic_affiliations
 * to ensure all affiliated doctors are returned.
 */
export function useClinicDoctors() {
  const { currentClinic } = useClinic();

  return useQuery<ClinicDoctor[]>({
    queryKey: ["clinic-doctors", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      // Get doctors from legacy clinic_id
      const { data: legacyDoctors } = await supabase
        .from("doctors")
        .select(`
          id,
          user_id,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq("clinic_id", currentClinic.id);

      // Get doctors from affiliations table
      const { data: affiliations } = await supabase
        .from("doctor_clinic_affiliations")
        .select("doctor_id")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true);

      const affiliatedDoctorIds = affiliations?.map(a => a.doctor_id) || [];
      
      // Merge: start with legacy doctors
      const doctorMap = new Map<string, ClinicDoctor>();
      (legacyDoctors || []).forEach(d => {
        doctorMap.set(d.id, d as ClinicDoctor);
      });

      // Fetch affiliated doctors not already in the map
      const missingIds = affiliatedDoctorIds.filter(id => !doctorMap.has(id));
      if (missingIds.length > 0) {
        const { data: extraDoctors } = await supabase
          .from("doctors")
          .select(`
            id,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          `)
          .in("id", missingIds);

        (extraDoctors || []).forEach(d => {
          doctorMap.set(d.id, d as ClinicDoctor);
        });
      }

      return Array.from(doctorMap.values());
    },
    enabled: !!currentClinic?.id,
  });
}

/**
 * Imperative function to load clinic doctors (for non-hook contexts).
 * Returns doctor IDs and profiles for a given clinic.
 */
export async function fetchClinicDoctors(clinicId: string): Promise<ClinicDoctor[]> {
  const [legacyRes, affRes] = await Promise.all([
    supabase
      .from("doctors")
      .select(`id, user_id, profiles:user_id (full_name, avatar_url)`)
      .eq("clinic_id", clinicId),
    supabase
      .from("doctor_clinic_affiliations")
      .select("doctor_id")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
  ]);

  const doctorMap = new Map<string, ClinicDoctor>();
  (legacyRes.data || []).forEach(d => doctorMap.set(d.id, d as ClinicDoctor));

  const missingIds = (affRes.data || [])
    .map(a => a.doctor_id)
    .filter(id => !doctorMap.has(id));

  if (missingIds.length > 0) {
    const { data } = await supabase
      .from("doctors")
      .select(`id, user_id, profiles:user_id (full_name, avatar_url)`)
      .in("id", missingIds);
    (data || []).forEach(d => doctorMap.set(d.id, d as ClinicDoctor));
  }

  return Array.from(doctorMap.values());
}
