import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useProfile() {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["current-user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name, middle_name, avatar_url, phone, email, role, account_number")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Пользователь";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const accountNumber: string | null = profile?.account_number ?? null;
  const initials = displayName
    .split(" ")
    .map((n: string) => n.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2) || "U";

  return {
    profile,
    displayName,
    avatarUrl,
    accountNumber,
    initials,
    isLoading,
  };
}
