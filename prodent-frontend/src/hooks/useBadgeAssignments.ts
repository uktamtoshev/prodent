import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

type BadgeField = "name" | "name_uz" | "name_en" | "icon" | "color" | "bg_color";

interface BadgeWire {
  name?: string | null;
  name_uz?: string | null;
  name_en?: string | null;
  icon?: string | null;
  color?: string | null;
  bg_color?: string | null;
}

interface BadgeAssignmentWire {
  id: string;
  badge_id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  badges?: BadgeWire | null;
  badges_name?: string | null;
  badges_name_uz?: string | null;
  badges_name_en?: string | null;
  badges_icon?: string | null;
  badges_color?: string | null;
  badges_bg_color?: string | null;
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

      // DataController shim returns embedded columns either as a nested
      // object (`item.badges.name`) or flattened with the `<table>_` prefix
      // (`item.badges_name`). Handle both so we work against either backend.
      return ((data || []) as BadgeAssignmentWire[]).map((item) => {
        const nested = item.badges || {};
        const get = (key: BadgeField) => nested[key] ?? item[`badges_${key}`];
        return {
          id: item.id,
          badge_id: item.badge_id,
          doctor_id: item.doctor_id,
          clinic_id: item.clinic_id,
          name: get("name") || "",
          name_uz: get("name_uz") || null,
          name_en: get("name_en") || null,
          icon: get("icon") || "Award",
          color: get("color") || "#3B82F6",
          bg_color: get("bg_color") || "#EFF6FF",
        };
      }) as ActiveBadge[];
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
