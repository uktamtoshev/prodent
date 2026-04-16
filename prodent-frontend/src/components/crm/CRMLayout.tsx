import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CRMSidebarNew } from "./CRMSidebarNew";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CRMLayoutProps {
  children: ReactNode;
}

export function CRMLayout({ children }: CRMLayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Доступ запрещен",
          description: "Пожалуйста, войдите в систему",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Check user_roles table first
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasRoleAccess = roles?.some(
        (r) => r.role === "doctor" || r.role === "clinic_admin" || r.role === "super_admin" || r.role === "admin"
      );

      if (hasRoleAccess) {
        setIsAuthorized(true);
        return;
      }

      // Check clinic_members table
      const { data: membership } = await supabase
        .from("clinic_members")
        .select("role")
        .eq("user_id", user.id);

      const hasMemberAccess = membership?.some(
        (m) => ["doctor", "clinic_admin", "clinic_manager", "assistant", "accountant"].includes(m.role)
      );

      if (hasMemberAccess) {
        setIsAuthorized(true);
        return;
      }

      toast({
        title: "Доступ запрещен",
        description: "Доступ только для сотрудников клиник",
        variant: "destructive",
      });
      navigate("/");
    } catch (error) {
      console.error("Error checking access:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось проверить права доступа",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground text-[15px]">
      <CRMSidebarNew />
      <main className="min-h-screen transition-all duration-200 lg:pl-56">
        {children}
      </main>
    </div>
  );
}
