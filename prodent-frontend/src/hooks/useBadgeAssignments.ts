import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";

export interface ActiveBadge {
  id: string;
  badge_id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  name: string;
  name_uz: string | null;
  name_en: string | null;
  icon: string;
  color: string;
  bg_color: string;
}

export const useActiveBadges = () => {
  return useQuery({
    queryKey: ["active-badges"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("badge_assignments")
        .select(
          `
          id,
          badge_id,
          doctor_id,
          clinic_id,
          badges (
            name,
            name_uz,
            name_en,
            icon,
            color,
            bg_color
          )
        `
        )
        .eq("is_active", true)
        .lte("start_date", now)
        .gte("end_date", now);

      if (error) throw error;

      // Transform to flat structure
      return (data || []).map((item) => ({
        id: item.id,
        badge_id: item.badge_id,
        doctor_id: item.doctor_id,
        clinic_id: item.clinic_id,
        name: (item.badges as any)?.name || "",
        name_uz: (item.badges as any)?.name_uz || null,
        name_en: (item.badges as any)?.name_en || null,
        icon: (item.badges as any)?.icon || "Award",
        color: (item.badges as any)?.color || "#3B82F6",
        bg_color: (item.badges as any)?.bg_color || "#EFF6FF",
      })) as ActiveBadge[];
    },
    // Badges are frequently updated by admins; keep UI fresh
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useDoctorBadges = (doctorId: string | undefined) => {
  const { data: allBadges } = useActiveBadges();
  
  if (!doctorId || !allBadges) return [];
  
  return allBadges.filter((badge) => badge.doctor_id === doctorId);
};

export const useClinicBadges = (clinicId: string | undefined) => {
  const { data: allBadges } = useActiveBadges();
  
  if (!clinicId || !allBadges) return [];
  
  return allBadges.filter((badge) => badge.clinic_id === clinicId);
};
