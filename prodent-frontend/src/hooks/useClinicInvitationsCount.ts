import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

/**
 * Number of PENDING clinic→doctor invitations addressed to the current doctor.
 * Drives the sidebar badge on the CRM "Приглашения клиник" item so a doctor sees
 * incoming invitations where they actually work (the CRM cabinet) instead of only
 * in the buried profile → Настройки tab. Refreshes periodically.
 */
export function useClinicInvitationsCount(): number {
  const { doctorId, isDoctor } = useUserRole();

  const { data } = useQuery({
    queryKey: ["pending-clinic-invitations-count", doctorId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("doctor_clinic_requests")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId as string)
        .eq("request_type", "clinic_to_doctor")
        .ilike("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!doctorId && isDoctor,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return data ?? 0;
}
